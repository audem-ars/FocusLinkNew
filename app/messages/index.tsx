// app/messages/index.tsx - Messaging between connected users
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Image // <-- Added Import
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  limit,
  getDocs,
  startAfter,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker'; // <-- Added Import
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // <-- ADDED IMPORT

// Types
interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: any;
  read: boolean;
  selected?: boolean; // For message selection
  imageUrl?: string; // <-- Added Field
  messageType?: 'text' | 'image'; // <-- Added Field
  senderName?: string; // For group messages
}

interface User {
  id: string;
  uid: string;
  name: string;
  email: string;
}

export default function MessagesScreen() {
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{ connectionId: string; userId: string; groupId: string }>();
  const insets = useSafeAreaInsets(); // <-- ADDED HOOK CALL
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [sending, setSending] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false); // <-- Added State
  const groupId = params.groupId;

  const MESSAGES_PER_PAGE = 20; // Number of messages to load initially and per "load more"
  const flatListRef = useRef<FlatList>(null);

  const connectionId = params.connectionId;
  const otherUserId = params.userId;

  // Load the other user's profile
  useEffect(() => {
    const loadOtherUser = async () => {
      if (!otherUserId) return;
      try {
        const userDocRef = doc(db, 'users', otherUserId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            setOtherUser({
                id: userDoc.id,
                uid: otherUserId,
                name: userData.name || 'User',
                email: userData.email || '',
            } as User);
        } else {
            console.log(`User document not found for ID: ${otherUserId}`);
            setOtherUser({ id: otherUserId, uid: otherUserId, name: 'Unknown User', email: '' });
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setOtherUser({ id: otherUserId, uid: otherUserId, name: 'Error Loading', email: '' });
      }
    };
    if (!groupId) { // Only load other user if it's not a group chat
        loadOtherUser();
    }
  }, [otherUserId, groupId]);

  // Load group data or initial direct messages
  useEffect(() => {
    const loadGroupData = async () => {
      if (!groupId || !currentUser) return;

      setLoading(true);
      try {
        // Get group info
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroupInfo(groupData);

          // Load group members
          const memberIds = groupData.members.map(member => member.userId);
          if (memberIds.length > 0) {
            const membersData = [];
            for (let i = 0; i < memberIds.length; i += 10) {
              const batch = memberIds.slice(i, i + 10);
              const usersRef = collection(db, 'users');
              const usersQuery = query(usersRef, where('uid', 'in', batch));
              const usersSnapshot = await getDocs(usersQuery);

              usersSnapshot.forEach(doc => {
                const userData = doc.data();
                membersData.push({
                  id: doc.id,
                  ...userData
                });
              });
            }
            setGroupMembers(membersData);
          }

          // Load messages
          loadGroupMessages(); // Load initial group messages
        } else {
          Alert.alert('Error', 'Group not found');
          router.back();
        }
      } catch (error) {
        console.error('Error loading group data:', error);
        Alert.alert('Error', 'Failed to load group data');
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      loadGroupData();
    } else if (connectionId && currentUser) {
      loadInitialMessages(); // Load initial direct messages
    } else {
        setLoading(false); // Ensure loading is set to false if no connection/group ID
    }
  }, [groupId, connectionId, currentUser]);


  // Load initial messages (most recent messages first) - for 1-on-1 chats
  const loadInitialMessages = async () => {
    if (!connectionId || !currentUser) return;
    setLoading(true);
    try {
      const messagesRef = collection(db, 'connections', connectionId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'), // Descending order for most recent first
        limit(MESSAGES_PER_PAGE)
      );

      const querySnapshot = await getDocs(messagesQuery);

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc);

        // Check if there might be more messages
        const moreQuery = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(1)
        );
        const moreSnapshot = await getDocs(moreQuery);
        setHasMoreMessages(!moreSnapshot.empty);
      } else {
        setHasMoreMessages(false);
      }

      const messagesList: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Message, 'id'>;
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
        messagesList.push({
          id: doc.id,
          ...data,
          timestamp: timestamp,
          selected: false, // Initialize selection state
          messageType: data.messageType || 'text' // Default to text if not present
        });
      });

      // Reverse to show in chronological order
      messagesList.reverse();

      setMessages(messagesList);
      markMessagesAsRead(messagesList);
    } catch (error) {
      console.error("Error loading initial messages:", error);
      Alert.alert("Error", "Could not load messages.");
    } finally {
      setLoading(false);
    }
  };

  // Load more messages when scrolling up - for 1-on-1 chats
  const loadMoreMessages = async () => {
    if (!connectionId || !currentUser || !lastVisible || !hasMoreMessages || loadingMore) return;

    setLoadingMore(true);
    try {
      const messagesRef = collection(db, 'connections', connectionId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(MESSAGES_PER_PAGE)
      );

      const querySnapshot = await getDocs(messagesQuery);

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc);

        // Check if there might be more messages
        const moreQuery = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(1)
        );
        const moreSnapshot = await getDocs(moreQuery);
        setHasMoreMessages(!moreSnapshot.empty);

        const newMessages: Message[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Message, 'id'>;
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          newMessages.push({
            id: doc.id,
            ...data,
            timestamp: timestamp,
            selected: false,
            messageType: data.messageType || 'text'
          });
        });

        // Reverse and prepend to existing messages
        newMessages.reverse();
        setMessages(prevMessages => [...newMessages, ...prevMessages]);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
      Alert.alert("Error", "Could not load more messages.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Load initial group messages
  const loadGroupMessages = async () => {
    if (!groupId || !currentUser) return;
    setLoading(true); // Ensure loading state is set
    try {
      const messagesRef = collection(db, 'groupMessages', groupId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(MESSAGES_PER_PAGE)
      );

      const querySnapshot = await getDocs(messagesQuery);

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc);

        const moreQuery = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(1)
        );
        const moreSnapshot = await getDocs(moreQuery);
        setHasMoreMessages(!moreSnapshot.empty);
      } else {
        setHasMoreMessages(false);
      }

      const messagesList: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
        messagesList.push({
          id: doc.id,
          ...data,
          timestamp: timestamp,
          selected: false,
          messageType: data.messageType || 'text'
        });
      });

      messagesList.reverse();
      setMessages(messagesList);
    } catch (error) {
      console.error('Error loading initial group messages:', error);
      Alert.alert('Error', 'Failed to load group messages');
    } finally {
        setLoading(false); // Ensure loading state is cleared
    }
  };

  // Load more group messages
  const loadMoreGroupMessages = async () => {
    if (!groupId || !currentUser || !lastVisible || !hasMoreMessages || loadingMore) return;

    setLoadingMore(true);
    try {
      const messagesRef = collection(db, 'groupMessages', groupId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(MESSAGES_PER_PAGE)
      );

      const querySnapshot = await getDocs(messagesQuery);

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc);

        const moreQuery = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(1)
        );
        const moreSnapshot = await getDocs(moreQuery);
        setHasMoreMessages(!moreSnapshot.empty);

        const newMessages: Message[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          newMessages.push({
            id: doc.id,
            ...data,
            timestamp: timestamp,
            selected: false,
            messageType: data.messageType || 'text'
          });
        });

        newMessages.reverse();
        setMessages(prevMessages => [...newMessages, ...prevMessages]);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading more group messages:', error);
      Alert.alert('Error', 'Failed to load more group messages');
    } finally {
      setLoadingMore(false);
    }
  };


  // Mark messages as read - Only for 1-on-1 chats
  const markMessagesAsRead = async (messagesList: Message[]) => {
    if (!currentUser || !connectionId || !messagesList || messagesList.length === 0 || groupId) return; // Don't run for groups

    try {
      const unreadMessages = messagesList.filter(msg => !msg.read && msg.senderId !== currentUser.uid);
      if (unreadMessages.length === 0) return;

      const readPromises = unreadMessages.map(message => {
          if (message.id) {
              const messageRef = doc(db, 'connections', connectionId, 'messages', message.id);
              return updateDoc(messageRef, { read: true });
          }
          return Promise.resolve(); // Return resolved promise if no id
      });
      await Promise.all(readPromises); // Update read status in parallel


      const connectionRef = doc(db, 'connections', connectionId);
      // Check if connection still exists before updating unread count
      const connectionDoc = await getDoc(connectionRef);
      if (connectionDoc.exists()) {
          // Only update unreadCount if it needs changing
          if (connectionDoc.data().unreadCount > 0) {
             await updateDoc(connectionRef, { unreadCount: 0 });
          }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send a 1-on-1 text message
  const sendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !currentUser || !connectionId || !otherUserId) return;

    setSending(true);
    const tempMessageText = trimmedText;
    setInputText('');

    try {
      const messagesRef = collection(db, 'connections', connectionId, 'messages');
      const newMessageData = {
        text: tempMessageText,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false,
        messageType: 'text' // Explicitly set type
      };
      const newMessageRef = await addDoc(messagesRef, newMessageData);

      const connectionRef = doc(db, 'connections', connectionId);
      const updateData = {
        lastMessage: tempMessageText,
        lastMessageDate: serverTimestamp(),
        lastActivity: serverTimestamp(),
        // Reset unread count for the sender (optional, but good practice)
        [`unreadCount_${currentUser.uid}`]: 0,
        // Increment unread count for the receiver
        [`unreadCount_${otherUserId}`]: (await getDoc(connectionRef)).data()?.[`unreadCount_${otherUserId}`] + 1 || 1
      };
      await updateDoc(connectionRef, updateData);

      // Add the new message to the local state
      const newMessage = {
        id: newMessageRef.id,
        ...newMessageData, // Spread the data used for Firestore
        timestamp: new Date(), // Use local time for immediate display
        selected: false
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
      setInputText(tempMessageText); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  // Send a group text message
  const sendGroupMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !currentUser || !groupId) return;

    setSending(true);
    const tempMessageText = trimmedText;
    setInputText('');

    try {
      const messagesRef = collection(db, 'groupMessages', groupId, 'messages');
      const newMessageData = {
        text: tempMessageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'You', // Store sender name
        timestamp: serverTimestamp(),
        read: false, // Not really used in groups, but consistent
        messageType: 'text'
      };
      const newMessageRef = await addDoc(messagesRef, newMessageData);

      // Update group document
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        lastMessage: tempMessageText,
        lastMessageBy: currentUser.uid,
        lastActivity: serverTimestamp()
      });

      // Add to local state
      const newMessage = {
        id: newMessageRef.id,
        ...newMessageData,
        timestamp: new Date(),
        selected: false
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);
    } catch (error) {
      console.error('Error sending group message:', error);
      Alert.alert('Error', 'Failed to send message');
      setInputText(tempMessageText); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  // Handle send button press - routes to correct send function
  const handleSendPress = () => {
    if (sending || uploadingImage) return; // Prevent double sends

    if (groupId) {
      sendGroupMessage();
    } else {
      sendMessage();
    }
  };

  // ---- Image Upload Functions ----

  const uploadMessageImage = async (uri: string): Promise<string> => {
    const IMGBB_API_KEY = "1620338bf14efdbb8df4d547343a9365"; // Consider moving to env variables

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to base64 more reliably
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Ensure result is a string and split correctly
           const resultStr = reader.result as string;
           if (typeof resultStr === 'string' && resultStr.includes(',')) {
               resolve(resultStr.split(',')[1]);
           } else {
               reject(new Error("Failed to read file as base64 data URL"));
           }
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(new Error("Failed to read file as base64"));
        };
        reader.readAsDataURL(blob);
      });

      const formData = new FormData();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', base64);

      const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
        // Add headers if needed, though FormData usually sets Content-Type
        // headers: { 'Content-Type': 'multipart/form-data' } // Usually not needed for fetch with FormData
      });

      if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("ImgBB Upload Error Response:", errorText);
          throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      const result = await uploadResponse.json();

      if (result.success && result.data?.display_url) {
        return result.data.display_url;
      } else {
        console.error("ImgBB API Error:", result.error?.message || result);
        throw new Error(result.error?.message || "Upload to ImgBB failed");
      }
    } catch (error) {
      console.error("Error during image upload process:", error);
      throw error; // Re-throw to be caught by pickImage
    }
  };


  const pickImage = async () => {
    if (uploadingImage || sending) return; // Prevent concurrent actions

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Correct enum usage
        allowsEditing: true,
        quality: 0.7, // Compress image slightly
        // base64: false, // Don't need base64 from picker if we fetch and convert manually
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setUploadingImage(true); // Indicate start of upload process

        try {
          const imageUrl = await uploadMessageImage(result.assets[0].uri);

          // Send message with image (choose correct function)
          if (groupId) {
            await sendGroupImageMessage(imageUrl);
          } else {
            await sendImageMessage(imageUrl);
          }
        } catch (error) {
          console.error('Error processing selected image:', error);
          Alert.alert('Upload Failed', 'Could not upload the image. Please try again.');
        } finally {
          setUploadingImage(false); // Indicate end of upload process
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'An error occurred while selecting the image.');
      setUploadingImage(false); // Ensure state is reset on picker error
    }
  };


  const sendImageMessage = async (imageUrl: string) => {
    if (!imageUrl || !currentUser || !connectionId || !otherUserId) return;

    // Note: setSending(true) is called *within* this function now
    setSending(true);

    try {
      const messagesRef = collection(db, 'connections', connectionId, 'messages');
      const newMessageData = {
        imageUrl: imageUrl,
        text: '', // Empty text for image-only messages
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false,
        messageType: 'image' as const // Use const assertion for literal type
      };
      const newMessageRef = await addDoc(messagesRef, newMessageData);

      const connectionRef = doc(db, 'connections', connectionId);
      const updateData = {
        lastMessage: '📷 Image', // Placeholder for image in conversation list
        lastMessageDate: serverTimestamp(),
        lastActivity: serverTimestamp(),
         // Reset unread count for the sender
        [`unreadCount_${currentUser.uid}`]: 0,
        // Increment unread count for the receiver
        [`unreadCount_${otherUserId}`]: (await getDoc(connectionRef)).data()?.[`unreadCount_${otherUserId}`] + 1 || 1
      };
      await updateDoc(connectionRef, updateData);

      // Add to local state immediately
      const newMessage: Message = {
        id: newMessageRef.id,
        ...newMessageData, // Spread data
        timestamp: new Date(), // Use local time for immediate display
        selected: false,
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);
    } catch (error) {
      console.error('Error sending image message:', error);
      Alert.alert('Error', 'Failed to send image message.');
      // Do not restore inputText as it wasn't used
    } finally {
      setSending(false); // Ensure sending is false after DB operations
    }
  };


  const sendGroupImageMessage = async (imageUrl: string) => {
    if (!imageUrl || !currentUser || !groupId) return;

    // Note: setSending(true) is called *within* this function now
    setSending(true);

    try {
      const messagesRef = collection(db, 'groupMessages', groupId, 'messages');
      const newMessageData = {
        imageUrl: imageUrl,
        text: '',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'You', // Include sender name
        timestamp: serverTimestamp(),
        read: false, // Consistent, though not used
        messageType: 'image' as const
      };
      const newMessageRef = await addDoc(messagesRef, newMessageData);

      // Update group document
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        lastMessage: '📷 Image',
        lastMessageBy: currentUser.uid,
        lastActivity: serverTimestamp()
      });

      // Add to local state immediately
      const newMessage: Message = {
        id: newMessageRef.id,
        ...newMessageData,
        timestamp: new Date(), // Use local time
        selected: false,
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);
    } catch (error) {
      console.error('Error sending group image message:', error);
      Alert.alert('Error', 'Failed to send group image.');
      // Do not restore inputText
    } finally {
      setSending(false); // Ensure sending is false after DB operations
    }
  };

  // ---- End Image Upload Functions ----


  // Toggle message selection
  const toggleMessageSelection = (messageId: string) => {
    if (!selectMode) return;

    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId ? { ...msg, selected: !msg.selected } : msg
      )
    );
  };

  // Toggle select mode
  const toggleSelectMode = () => {
    if (selectMode) {
      // Clear all selections when exiting select mode
      setMessages(prevMessages =>
        prevMessages.map(msg => ({ ...msg, selected: false }))
      );
    }
    setSelectMode(!selectMode);
  };

  // Select all messages
  const selectAllMessages = () => {
    setMessages(prevMessages =>
      prevMessages.map(msg => ({ ...msg, selected: true }))
    );
  };

  // Delete selected messages - Handles both group and direct messages
  const deleteSelectedMessages = async () => {
    const selectedMessages = messages.filter(msg => msg.selected);

    if (selectedMessages.length === 0) {
      Alert.alert("No Messages Selected", "Please select messages to delete.");
      return;
    }

    setDeleteModalVisible(false); // Close modal first

    try {
        const collectionPath = groupId ? `groupMessages/${groupId}/messages` : `connections/${connectionId}/messages`;

        // Delete each message from Firestore in parallel
        const deletePromises = selectedMessages.map(message => {
            const messageRef = doc(db, collectionPath, message.id);
            return deleteDoc(messageRef);
        });
        await Promise.all(deletePromises);

        // Update local state *after* successful deletion
        const remainingMessages = messages.filter(msg => !msg.selected);
        setMessages(remainingMessages);

        // Update last message in the connection/group if needed
        if (remainingMessages.length > 0) {
            // Find the new last message based on timestamp (most recent)
            const newLastMessage = remainingMessages.reduce((latest, current) =>
                (current.timestamp > latest.timestamp) ? current : latest
            );

            const lastMessageText = newLastMessage.messageType === 'image' ? '📷 Image' : newLastMessage.text;
            const lastMessageTimestamp = newLastMessage.timestamp instanceof Date
                ? Timestamp.fromDate(newLastMessage.timestamp)
                : newLastMessage.timestamp; // Assume it's already a Timestamp if not a Date


            if (groupId) {
                const groupRef = doc(db, 'groups', groupId);
                await updateDoc(groupRef, {
                    lastMessage: lastMessageText,
                    lastMessageBy: newLastMessage.senderId,
                    lastActivity: lastMessageTimestamp // Use actual timestamp
                });
            } else if (connectionId) {
                const connectionRef = doc(db, 'connections', connectionId);
                await updateDoc(connectionRef, {
                    lastMessage: lastMessageText,
                    lastMessageDate: lastMessageTimestamp // Use actual timestamp
                });
            }
        } else {
            // No messages left, clear last message
             if (groupId) {
                const groupRef = doc(db, 'groups', groupId);
                await updateDoc(groupRef, {
                    lastMessage: '',
                    lastMessageBy: null, // Use null instead of empty string for ID
                    lastActivity: serverTimestamp()
                });
            } else if (connectionId) {
                const connectionRef = doc(db, 'connections', connectionId);
                await updateDoc(connectionRef, {
                    lastMessage: '',
                    lastMessageDate: serverTimestamp()
                    // Optionally clear unread counts here too
                });
            }
        }

        // Exit select mode
        setSelectMode(false);
        // Alert.alert("Success", `${selectedMessages.length} message(s) deleted.`); // More specific success message

    } catch (error) {
      console.error('Error deleting messages:', error);
      Alert.alert("Error", "Failed to delete selected messages. Please try again.");
       // Consider how to handle partial failures if needed
    }
  };

  // Delete all messages - Handles both group and direct messages
  const deleteAllMessages = async () => {
    setDeleteModalVisible(false); // Close modal first

    if (messages.length === 0) {
        Alert.alert("No Messages", "There are no messages to delete.");
        return;
    }

    try {
      const collectionPath = groupId ? `groupMessages/${groupId}/messages` : `connections/${connectionId}/messages`;
      const messagesRef = collection(db, collectionPath);

      // Efficiently delete all documents in a subcollection (requires careful handling in production, consider batching or cloud function for large collections)
      // For moderate amounts, getting all docs and deleting one by one is acceptable.
      const messagesQuery = query(messagesRef);
      const querySnapshot = await getDocs(messagesQuery);

      const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
      await Promise.all(deletePromises);

      // Update connection/group to have no last message
      if (groupId) {
        const groupRef = doc(db, 'groups', groupId);
        await updateDoc(groupRef, {
          lastMessage: '',
          lastMessageBy: null,
          lastActivity: serverTimestamp()
        });
      } else if (connectionId) {
        const connectionRef = doc(db, 'connections', connectionId);
        await updateDoc(connectionRef, {
          lastMessage: '',
          lastMessageDate: serverTimestamp()
          // Optionally clear unread counts here too
        });
      }

      // Clear local state
      setMessages([]);
      setSelectMode(false); // Ensure select mode is exited
      // Alert.alert("Success", "All messages deleted.");

    } catch (error) {
      console.error('Error deleting all messages:', error);
      Alert.alert("Error", "Failed to delete all messages. Please try again.");
    }
  };


  // Scroll to bottom when a new message is sent or initially loaded
  useEffect(() => {
    if (messages.length > 0 && !loading && !loadingMore) {
      // Only scroll if the last message is from the current user OR if loading just finished
      // Check if flatListRef.current exists before calling methods
      if (flatListRef.current) {
         // Give layout a moment to settle, especially after loading more at the top
         setTimeout(() => {
             flatListRef.current?.scrollToEnd({ animated: true });
         }, 150);
      }
    }
  }, [messages, loading]); // Trigger on messages change and when loading finishes


  // ULTRA-SIMPLE-PLUS message rendering - handles text and images
  const renderMessage = ({ item }: { item: Message }) => {
    const isFromMe = item.senderId === currentUser?.uid;

    // Simple time formatting
    let timeString = '--:--';
    if (item.timestamp) {
       try {
        // Handle both Firestore Timestamps and JS Dates (from local add)
        const date = item.timestamp instanceof Timestamp
                      ? item.timestamp.toDate()
                      : (item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp)); // Fallback for potential string/number timestamp

        if (date instanceof Date && !isNaN(date.getTime())) {
            timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } else {
             console.warn("Invalid timestamp object for formatting:", item.timestamp);
            timeString = 'Invalid time';
        }
       } catch (e) {
           console.error("Error formatting time:", e, "Timestamp:", item.timestamp);
           timeString = 'Error time';
       }
    }

    const showSenderName = groupId && !isFromMe && item.senderName;

    // Totally detached message display - zero dependencies on other styles
    return (
      <TouchableOpacity
        onLongPress={toggleSelectMode} // Enable long press only if not already selecting? No, allow toggling off.
        onPress={() => selectMode && toggleMessageSelection(item.id)} // Only toggle selection if in select mode
        activeOpacity={selectMode ? 0.6 : 1} // Visual feedback during selection
        style={{
          width: '100%',
          alignItems: isFromMe ? 'flex-end' : 'flex-start',
          marginVertical: 4, // Reduced vertical margin slightly
          paddingHorizontal: 8,
        }}
      >
        <View style={{
          backgroundColor: item.selected ? '#B2D8FF' : isFromMe ? '#4299E1' : '#EDF2F7',
          borderRadius: 16,
          paddingVertical: item.messageType === 'image' ? 5 : 10, // Less padding for images
          paddingHorizontal: item.messageType === 'image' ? 5 : 14,
          maxWidth: '75%', // Slightly wider max width
          minWidth: 80, // Ensure time fits well
          marginHorizontal: 4,
          // Add shadow for elevation (optional)
          // shadowColor: "#000",
          // shadowOffset: { width: 0, height: 1 },
          // shadowOpacity: 0.1,
          // shadowRadius: 1,
          // elevation: 1,
        }}>
          {/* Sender Name (for group chats) */}
          {showSenderName && (
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: isFromMe ? 'rgba(255,255,255,0.8)' : '#4A5568', // Adjust color based on bubble
              marginBottom: 3,
              marginLeft: item.messageType === 'image' ? 0 : 2, // Align with text/image edge
            }}>
              {item.senderName}
            </Text>
          )}

          {/* Image display */}
          {item.messageType === 'image' && item.imageUrl && (
            // Wrap Image in a View for better control over margins if needed
            <View style={{ marginBottom: item.text ? 5 : 0 }}>
              <Image
                source={{ uri: item.imageUrl }}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 12, // Match bubble radius more closely
                  resizeMode: 'cover',
                  backgroundColor: '#E2E8F0' // Placeholder color while loading
                }}
                // Add accessibility label for images
                accessibilityLabel={isFromMe ? "Image sent by you" : `Image sent by ${item.senderName || 'other user'}`}
              />
            </View>
          )}

          {/* Message text (only show if text exists) */}
          {item.text && (
             <Text
               style={{
                 color: item.selected ? '#333333' : isFromMe ? 'white' : '#333333',
                 fontSize: 16,
                 fontWeight: '400',
                 lineHeight: 22,
                 // Remove margin bottom if time is directly below
                 // marginBottom: 3,
                 paddingRight: 3, // Ensure text doesn't touch edge
                 fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
               }}
               allowFontScaling={true} // Allow user font scaling preference
               selectable={true} // Allow text selection
             >
               {item.text}
             </Text>
          )}

          {/* Time display */}
          <View style={{ alignSelf: 'flex-end', marginTop: 4 }}>
             <Text style={{
               fontSize: 11,
               color: item.selected ? '#333333' : isFromMe ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
               // alignSelf: 'flex-end', // Moved to parent View
               // marginTop: item.messageType === 'image' && !item.text ? 3 : 2, // Adjust margin based on content
               // marginBottom: 1, // Remove if no extra space needed below
               // marginRight: 2, // Add padding to parent instead if needed
             }}>
               {timeString}
               {/* FIX: Use ternary operator for read receipts */}
               {isFromMe && !groupId ? (item.read ? ' ✓✓' : ' ✓') : null}
             </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render header for load more functionality (handles both direct and group)
  const renderListHeader = () => {
    // Only show if loadingMore is false and there are potentially more messages
    if (loadingMore || !hasMoreMessages) return null;

    const handleLoadMore = groupId ? loadMoreGroupMessages : loadMoreMessages;

    return (
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
         <TouchableOpacity
           style={{
             paddingHorizontal: 15,
             paddingVertical: 8,
             backgroundColor: '#E2E8F0', // Lighter background
             borderRadius: 15, // Pill shape
           }}
           onPress={handleLoadMore}
           disabled={loadingMore} // Already checked above, but good practice
         >
           <Text style={{ color: '#4A5568', fontWeight: '500' }}>Load Earlier</Text>
         </TouchableOpacity>
      </View>
    );
  };

  // Render footer for loading indicator when loading more
  const renderListFooter = () => {
      if (!loadingMore) return null;
      return (
          <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#4299E1" />
          </View>
      );
  }


  // Render empty list
  const renderEmptyList = () => (
    <View style={{
      flex: 1, // Take available space
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      // backgroundColor: '#F8F9FA', // Match background
    }}>
      {loading ? (
        <ActivityIndicator size="large" color="#4299E1" />
      ) : (
        <View style={{alignItems: 'center'}}>
            <Icon name="message-outline" size={40} color="#CBD5E0" style={{marginBottom: 12}}/>
            <Text style={{
                fontSize: 17, // Slightly larger
                fontWeight: '600',
                color: '#718096',
                marginBottom: 8,
            }}>
                {groupId ? 'Group Started' : 'Chat Started'}
            </Text>
            <Text style={{
                fontSize: 14,
                color: '#A0AEC0',
                textAlign: 'center',
                lineHeight: 20,
            }}>
                {groupId ? 'Be the first to send a message in this group!' :
                 otherUser?.name ? `This is the beginning of your conversation with ${otherUser.name}.` : 'Send the first message to start chatting.'}
            </Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: '#F8F9FA', // Light grey background
      }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} // Use 'height' only if padding causes issues
      // Adjust offset based on the *new* fixed header height (60 + safe area)
      keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + 60) : 0}
    >
      <StatusBar style="dark" />

      {/* ====== START: NEW HEADER CODE ====== */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 10, // Add extra padding beyond safe area
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        height: insets.top + 60, // Set fixed height that includes status bar + content
      }}>
        {/* Back button */}
        {/* ---- START: UPDATED BACK BUTTON CODE ---- */}
        <TouchableOpacity
          onPress={() => {
            if (selectMode) {
              toggleSelectMode();
            } else if (groupId) {
              // Navigate back to circles tab with groups tab selected
              router.replace({ pathname: '/circles', params: { initialTab: 'groups' } });
            } else {
              // For individual chats, go to circles with connections tab selected
              router.replace({ pathname: '/circles', params: { initialTab: 'connections' } });
            }
          }}
          style={{
            padding: 8,
            marginLeft: -8
          }}
        >
          <Text style={{
            fontSize: 16,
            color: '#4299E1',
            fontWeight: '500',
          }}>
            {selectMode ? 'Cancel' : '← Back'}
          </Text>
        </TouchableOpacity>
        {/* ---- END: UPDATED BACK BUTTON CODE ---- */}

        {/* Title */}
        <View style={{
          flex: 1,
          alignItems: 'center',
          marginHorizontal: 8,
        }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#2D3748',
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectMode ? `Selected (${messages.filter(msg => msg.selected).length})` :
            groupInfo ? groupInfo.name :
            otherUser?.name || 'Chat'}
          </Text>
          {groupInfo && !selectMode && (
            <Text
              style={{
                fontSize: 12,
                color: '#718096',
                marginTop: 2,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
            </Text>
          )}
        </View>

        {/* Right side actions (Select/Delete) */}
        <TouchableOpacity
          onPress={selectMode ? () => {
              if (messages.filter(msg => msg.selected).length > 0) {
                  setDeleteModalVisible(true)
              } else {
                  Alert.alert("No Selection", "Select messages to delete first.")
              }
          } : toggleSelectMode}
          style={{
            padding: 8,
            marginRight: -8
          }}
          disabled={!selectMode && messages.length === 0}
        >
          <Text style={{
            fontSize: 15,
            color: selectMode
                      ? (messages.filter(msg => msg.selected).length > 0 ? '#E53E3E' : '#A0AEC0')
                      : (messages.length === 0 ? '#A0AEC0' : '#4299E1'),
            fontWeight: '500',
          }}>
            {selectMode ? 'Delete' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>
      {/* ====== END: NEW HEADER CODE ====== */}


      {/* Select mode toolbar */}
      {selectMode && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between', // Space out buttons
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: '#F0F4F8', // Light background for toolbar
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}>
          <TouchableOpacity onPress={selectAllMessages}>
            <Text style={{ color: '#4299E1', fontWeight: '500' }}>Select All</Text>
          </TouchableOpacity>

          {/* Maybe add "Deselect All" if needed */}
          {/* <Text style={{ color: '#718096' }}>
            {messages.filter(msg => msg.selected).length} selected
          </Text> */}
        </View>
      )}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={{ flex: 1, backgroundColor: '#F8F9FA' }} // Ensure background color consistency
        contentContainerStyle={{
          paddingVertical: 8,
          paddingHorizontal: 4, // Keep horizontal padding minimal
          flexGrow: 1, // Ensures empty state centers properly
        }}
        ListHeaderComponent={renderListHeader} // Load more button at the top
        // ListFooterComponent={renderListFooter} // Loading indicator at the bottom (optional, better for infinite scroll)
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={true}
        inverted={false} // Standard order (oldest at top)
        // onEndReached={groupId ? loadMoreGroupMessages : loadMoreMessages} // Use if you prefer infinite scroll at bottom
        onEndReachedThreshold={0.5} // How close to bottom to trigger onEndReached
        initialNumToRender={MESSAGES_PER_PAGE} // Render initial batch quickly
        maxToRenderPerBatch={10} // Control render batches during scroll
        windowSize={10} // Control how many items are kept rendered off-screen
        keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside input
      />

      {/* Input area (hidden in select mode) */}
      {!selectMode && (
        <View style={{
          flexDirection: 'row',
          paddingHorizontal: 12,
          paddingVertical: 8,
          // Use safe area bottom inset for paddingBottom, plus a little extra
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          alignItems: 'flex-end', // Align items to the bottom
        }}>
          {/* Camera Button */}
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: uploadingImage || sending ? '#CBD5E0' : '#E2E8F0', // Grey out when disabled
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              marginBottom: Platform.OS === 'ios' ? 0 : 2, // Align with text input bottom
            }}
            onPress={pickImage}
            disabled={uploadingImage || sending} // Disable if uploading or sending text
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color="#4299E1" />
            ) : (
              <Icon name="camera-plus-outline" size={22} color={uploadingImage || sending ? '#A0AEC0' : '#4299E1'} /> // Use a different icon?
            )}
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#F7FAFC',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              borderRadius: 20, // Consistent rounding
              paddingHorizontal: 16,
              paddingTop: Platform.OS === 'ios' ? 10 : 8, // Adjust padding for vertical alignment
              paddingBottom: Platform.OS === 'ios' ? 10 : 8,
              marginRight: 8,
              fontSize: 16,
              maxHeight: 120, // Allow slightly more height for multiline
              minHeight: 40, // Ensure consistent button alignment
              textAlignVertical: 'center', // Center text vertically (Android)
              color: '#2D3748', // Darker text color
            }}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..." // Shorter placeholder
            placeholderTextColor="#A0AEC0"
            multiline
            allowFontScaling={true} // Respect user font size settings
            editable={!sending && !uploadingImage} // Prevent editing while operations are in progress
          />

          {/* Send Button */}
          <TouchableOpacity
            style={{
              backgroundColor: !inputText.trim() || sending || uploadingImage ? '#A0AEC0' : '#4299E1', // Disable if no text, sending, or uploading
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Platform.OS === 'ios' ? 0 : 2, // Align with text input bottom
            }}
            onPress={handleSendPress}
            disabled={!inputText.trim() || sending || uploadingImage} // Disable if no text, sending, or uploading
          >
            {sending ? ( // Show indicator only during text/image sending (db operation)
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="send-circle-outline" size={24} color="#FFFFFF" /> // Use a different icon?
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)', // Darker background dim
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          {/* Modal Content */}
          <View style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 20,
            paddingTop: 25, // More space at the top
            width: '90%',
            maxWidth: 340, // Limit max width
            alignItems: 'center', // Center content inside modal
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#2D3748',
              marginBottom: 12, // Reduced margin
              textAlign: 'center',
            }}>
              Delete Messages?
            </Text>

            <Text style={{
              fontSize: 15, // Slightly smaller
              color: '#4A5568',
              marginBottom: 24,
              textAlign: 'center',
              lineHeight: 21, // Improve readability
            }}>
               This action cannot be undone. Choose what you want to delete.
            </Text>

            {/* Delete Selected Button */}
            <TouchableOpacity
              style={{
                // Use a consistent style for buttons
                backgroundColor: messages.filter(msg => msg.selected).length === 0 ? '#E2E8F0' : '#FFF5F5',
                paddingVertical: 14, // Larger touch area
                borderRadius: 8,
                marginBottom: 12,
                width: '100%', // Make buttons full width
                borderWidth: 1,
                borderColor: messages.filter(msg => msg.selected).length === 0 ? '#CBD5E0' : '#FED7D7'
              }}
              onPress={deleteSelectedMessages}
              disabled={messages.filter(msg => msg.selected).length === 0}
            >
              <Text style={{
                color: messages.filter(msg => msg.selected).length === 0 ? '#A0AEC0' : '#E53E3E',
                fontWeight: '600',
                fontSize: 16,
                textAlign: 'center',
              }}>
                Delete Selected ({messages.filter(msg => msg.selected).length})
              </Text>
            </TouchableOpacity>

            {/* Delete All Button */}
            <TouchableOpacity
              style={{
                backgroundColor: '#FFF5F5',
                paddingVertical: 14,
                borderRadius: 8,
                marginBottom: 20,
                width: '100%',
                borderWidth: 1,
                borderColor: '#FED7D7'
              }}
              onPress={deleteAllMessages}
              // Disable if there are no messages at all
              disabled={messages.length === 0}
            >
              <Text style={{
                 color: messages.length === 0 ? '#A0AEC0' : '#E53E3E',
                fontWeight: '600',
                fontSize: 16,
                textAlign: 'center',
              }}>
                Delete All ({messages.length})
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={{
                paddingVertical: 12, // Slightly smaller padding for cancel
                width: '100%',
              }}
              onPress={() => setDeleteModalVisible(false)}
            >
              <Text style={{
                color: '#4299E1', // Blue color for cancel
                fontWeight: '600',
                fontSize: 16,
                textAlign: 'center',
              }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}