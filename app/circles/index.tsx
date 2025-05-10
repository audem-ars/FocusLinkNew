// @ts-nocheck  // Keep this if you still have type issues you haven't resolved
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView, // Keep ScrollView
  Alert,
  Image,
  Platform,
  Modal // Import Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useGoals } from '../../src/context/GoalContext';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

// Types
interface User {
  id?: string;
  uid: string;
  name: string;
  email: string;
  bio?: string;
  displayLocation?: string;
  photoURL?: string;
  goal?: string;
  goals?: {
    id: string;
    text: string;
    isActive: boolean;
    alreadyDoing: boolean;
  }[];
  synergy?: number;
  keywords?: string[];
}

interface Connection {
  id: string;
  users: string[];
  lastMessage?: string;
  lastMessageDate?: any;
  unreadCount?: number;
  status?: 'pending' | 'accepted' | 'declined'; // Add status
  requestedBy?: string; // Add who requested
  createdAt?: any;
  acceptedAt?: any;
  lastActivity?: any;
}

// Starry background component for header
const StarryBackground = () => {
  // Create stars with random positions
  const stars = Array.from({ length: 50 }, (_, i) => {
    const size = Math.random() * 1.5 + 0.5;
    const opacity = useSharedValue(Math.random() * 0.5 + 0.3);
    
    // Animate star twinkling
    React.useEffect(() => {
      opacity.value = withRepeat(
        withTiming(Math.random() * 0.3 + 0.7, {
          duration: 1000 + Math.random() * 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1, // infinite repeat
        true // reverse
      );
    }, []);
    
    const animatedStyle = useAnimatedStyle(() => {
      return {
        opacity: opacity.value,
      };
    });
    
    return (
      <Animated.View
        key={i}
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            backgroundColor: i % 5 === 0 ? '#8BE8FF' : i % 7 === 0 ? '#FFDA9E' : '#FFFFFF',
            borderRadius: size,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          },
          animatedStyle,
        ]}
      />
    );
  });
  
  return stars;
};


export default function CirclesScreen() {
  const { currentUser, userProfile } = useAuth();
  const { activeGoals, planningGoals } = useGoals();
  const insets = useSafeAreaInsets();

  const [tabView, setTabView] = useState<'discover' | 'connections' | 'groups'>('discover');
  const [loading, setLoading] = useState(true);
  const [potentialConnections, setPotentialConnections] = useState<User[]>([]);
  const [userConnections, setUserConnections] = useState<Connection[]>([]);
  const [connectionProfiles, setConnectionProfiles] = useState<{[key: string]: User}>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const params = useLocalSearchParams();
  const [userGroups, setUserGroups] = useState<any[]>([]);
const [loadingGroups, setLoadingGroups] = useState(false);

useEffect(() => {
  if (params.initialTab && 
     (params.initialTab === 'discover' || 
      params.initialTab === 'connections' || 
      params.initialTab === 'groups')) { // Add 'groups' to the check
    setTabView(params.initialTab);
  }
    
    // Handle showing specific connection if needed
    if (params.showConnection) {
      // Logic to highlight/open the specific connection
    }
  }, []);

  // --- (Keep all functions: sendConnectionRequest, loadConnections, findSynergyConnections, etc.) ---
  const sendConnectionRequest = async (userId: string) => {
    if (!currentUser || !userId) {
        console.error("Cannot send request: Missing currentUser or userId");
        Alert.alert("Error", "Could not send request. User information missing.");
        return;
    }

    try {
      const ids = [currentUser.uid, userId].sort();
      const connectionId = ids.join('_');
      const connectionRef = doc(db, 'connections', connectionId);
      const connectionDoc = await getDoc(connectionRef);

      if (connectionDoc.exists()) {
        const connectionData = connectionDoc.data();
        if (connectionData?.status === 'accepted') {
          Alert.alert('Already Connected', 'You already have a connection with this user.');
        } else if (connectionData?.status === 'pending') {
          if (connectionData?.requestedBy === currentUser.uid) {
             Alert.alert('Request Pending', 'Your connection request is still pending.');
          } else {
             Alert.alert('Request Received', 'This user has sent you a connection request. Check your connections tab to accept.');
          }
        } else {
           Alert.alert('Connection Record Exists', 'A connection record exists with this user (check status).');
        }
        return;
      }

      await setDoc(connectionRef, {
        id: connectionId,
        users: [currentUser.uid, userId],
        status: 'pending',
        requestedBy: currentUser.uid,
        createdAt: new Date(),
        lastActivity: new Date(),
        // Initialize unread counts for both users to 0
        [`unreadCount_${currentUser.uid}`]: 0,
        [`unreadCount_${userId}`]: 0,
        lastMessage: null,
        lastMessageDate: null,
      });

      Alert.alert('Request Sent', 'Your connection request has been sent!');
      // Refresh discover list potentially to remove this user or update their card state
       findSynergyConnections(); // Re-run discovery to remove the newly requested user

    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request. Please try again.');
    }
  };

  const loadConnections = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', currentUser.uid)
        // Optional: Order by lastActivity to show recent chats first in 'accepted'
        // orderBy('lastActivity', 'desc') // Requires composite index
      );

      const querySnapshot = await getDocs(connectionsQuery);
      const connections: Connection[] = [];
      const otherUserIds = new Set<string>(); // Use Set for unique IDs

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Connection;
        connections.push({
          id: doc.id,
          ...data
        });

        const otherUserId = data.users.find(id => id !== currentUser.uid);
        if (otherUserId) {
          otherUserIds.add(otherUserId);
        }
      });

      // Sort connections: Pending received first, then accepted (by activity?), then pending sent
      connections.sort((a, b) => {
          // Priority 1: Pending requests received by current user
          const aIsPendingReceived = a.status === 'pending' && a.requestedBy !== currentUser.uid;
          const bIsPendingReceived = b.status === 'pending' && b.requestedBy !== currentUser.uid;
          if (aIsPendingReceived && !bIsPendingReceived) return -1;
          if (!aIsPendingReceived && bIsPendingReceived) return 1;

          // Priority 2: Accepted connections (sort by last activity, newest first)
          const aIsAccepted = a.status === 'accepted';
          const bIsAccepted = b.status === 'accepted';
          if (aIsAccepted && !bIsAccepted) return -1;
          if (!aIsAccepted && bIsAccepted) return 1;
          if (aIsAccepted && bIsAccepted) {
              const dateA = a.lastActivity?.toDate ? a.lastActivity.toDate() : new Date(0);
              const dateB = b.lastActivity?.toDate ? b.lastActivity.toDate() : new Date(0);
              return dateB.getTime() - dateA.getTime(); // Descending order
          }

           // Priority 3: Pending requests sent by current user
           const aIsPendingSent = a.status === 'pending' && a.requestedBy === currentUser.uid;
           const bIsPendingSent = b.status === 'pending' && b.requestedBy === currentUser.uid;
           if (aIsPendingSent && !bIsPendingSent) return -1; // Should already be handled by sorting accepted first
           if (!aIsPendingSent && bIsPendingSent) return 1;

           return 0; // Keep original order if same category/status
      });


      setUserConnections(connections);

      // Load profiles
      const profiles: {[key: string]: User} = {};
      if (otherUserIds.size > 0) {
         const uniqueIds = Array.from(otherUserIds);
         // Fetch profiles in batches of 10 (Firestore 'in' query limit)
         for (let i = 0; i < uniqueIds.length; i += 10) {
             const batchIds = uniqueIds.slice(i, i + 10);
             const profilesQuery = query(collection(db, 'users'), where('uid', 'in', batchIds));
             const profileSnapshots = await getDocs(profilesQuery);
             profileSnapshots.forEach(userDoc => {
                  const userData = userDoc.data() as User;
                  if(userData.uid) { // Ensure UID exists before adding
                     profiles[userData.uid] = { // Use UID as the key for easy lookup
                         id: userDoc.id, // Firestore document ID
                         ...userData
                     };
                  } else {
                     console.warn("User document missing UID:", userDoc.id, userDoc.data());
                  }
             });
         }
      }

      setConnectionProfiles(profiles);
    } catch (error) {
      console.error('Error loading connections:', error);
       Alert.alert("Error", "Could not load your connections.");
    } finally {
      setLoading(false);
    }
  };

  const loadUserGroups = async () => {
    if (!currentUser) return;
    
    setLoadingGroups(true);
    try {
      // Query for groups that the user is a member of
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', {
          userId: currentUser.uid,
          role: 'admin', // This needs to be modified to check all roles
        })
      );
      
      // This query might not work directly due to how we structured the members array
      // An alternative approach is to use a separate collection for group memberships
      // Or restructure how members are stored
      
      // For now, this is a simplified approach:
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      const groups: any[] = [];
      
      groupsSnapshot.forEach(doc => {
        const groupData = doc.data();
        // Check if the current user is a member
        const isMember = groupData.members.some(
          (member: any) => member.userId === currentUser.uid
        );
        
        if (isMember) {
          groups.push({
            id: doc.id,
            ...groupData
          });
        }
      });
      
      setUserGroups(groups);
    } catch (error) {
      console.error('Error loading groups:', error);
      Alert.alert('Error', 'Failed to load your groups.');
    } finally {
      setLoadingGroups(false);
    }
  };
  
  // Update your useEffect to load groups when the groups tab is selected
  useEffect(() => {
    if (currentUser) {
      if (tabView === 'discover') {
        // Your existing discover tab logic
      } else if (tabView === 'connections') {
        // Your existing connections tab logic
      } else if (tabView === 'groups') {
        loadUserGroups();
      }
    } else {
      setPotentialConnections([]);
      setUserConnections([]);
      setConnectionProfiles({});
      setUserGroups([]);
      setLoading(false);
    }
  }, [currentUser, tabView]);
  
  // Add a renderGroupItem function
const renderGroupItem = ({ item }) => {
  // Check if user is admin
  const isAdmin = item.members?.some(
    member => member.userId === currentUser?.uid && member.role === 'admin'
  );
  
  return (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => router.push({
        pathname: '/messages',
        params: { groupId: item.id }
      })}
    >
      {item.photoURL ? (
        <Image 
          source={{ uri: item.photoURL }} 
          style={styles.groupAvatar}
        />
      ) : (
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembersCount}>
          {item.members.length} members
        </Text>
      </View>
      
      {isAdmin && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push({
            pathname: '/circles/edit-group',
            params: { groupId: item.id }
          })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

   const findSynergyConnections = async () => {
    if (!currentUser || !userProfile || !userProfile.goals) {
         console.log("Cannot find synergy: Missing current user or profile/goals.");
         setLoading(false);
         return;
     };

    setLoading(true);
    try {
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', currentUser.uid)
      );
      const connectionsSnapshot = await getDocs(connectionsQuery);
      const connectedUserIds = new Set<string>([currentUser.uid]);
      connectionsSnapshot.forEach(doc => {
        const data = doc.data();
        data.users.forEach((uid: string) => connectedUserIds.add(uid));
      });
       console.log("Excluding already connected/pending users:", Array.from(connectedUserIds));

      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef); // Caution: Fetches ALL users

      const users: User[] = [];
      const userGoals = [...(activeGoals || []), ...(planningGoals || [])];
      const userKeywords = extractKeywords(userGoals.map(g => g.text));
      console.log("Current user keywords:", userKeywords);

      usersSnapshot.forEach((doc) => {
        const userData = doc.data() as User;
        const userUid = userData.uid;

         if (!userUid || connectedUserIds.has(userUid)) {
             // console.log(`Skipping user ${userData.name || userUid || doc.id} - self, missing UID, or already connected/pending.`);
             return;
         }
        if (!userData.goals || userData.goals.length === 0) {
          // console.log(`Skipping user ${userData.name} (ID: ${userUid}) - no goals.`);
          return;
        };

        const otherUserKeywords = extractKeywords(userData.goals.map(g => g.text));
        const synergyScore = calculateSynergy(userKeywords, otherUserKeywords);
        // console.log(`User: ${userData.name}, Keywords: ${otherUserKeywords}, Synergy: ${synergyScore}`);

        if (synergyScore > 0) {
          users.push({
            id: doc.id,
            ...userData,
            synergy: synergyScore,
            keywords: otherUserKeywords
          });
        }
        // else { console.log(`Skipping user ${userData.name} (ID: ${userUid}) - zero synergy.`); }
      });

      users.sort((a, b) => (b.synergy || 0) - (a.synergy || 0));
      console.log(`Found ${users.length} potential connections with synergy > 0.`);
      setPotentialConnections(users);

    } catch (error) {
      console.error('Error finding synergy connections:', error);
       Alert.alert("Error", "Could not find potential connections.");
    } finally {
      setLoading(false);
    }
  };

  // --- extractKeywords and calculateSynergy functions remain the same ---
  const extractKeywords = (texts: string[]): string[] => {
     if (!texts || texts.length === 0) return [];
    const allText = texts.join(' ').toLowerCase();
    const commonWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'i', 'is', 'my', 'with', 'for', 'by', 'be', 'am', 'are', 'on', 'at', 'it', 'an', 'as', 'me', 'we', 'us', 'our', 'you', 'your']);
    const words = allText.split(/[^a-z0-9]+/)
      .filter(word =>
        word.length > 2 &&
        !commonWords.has(word) &&
        !/^\d+$/.test(word)
      );
    return [...new Set(words)];
  };

 const calculateSynergy = (userKeywords: string[], otherKeywords: string[]): number => {
    if (!userKeywords || !otherKeywords || userKeywords.length === 0 || otherKeywords.length === 0) {
        return 0;
    }
    const matches = userKeywords.filter(word => otherKeywords.includes(word)).length;
    const uniqueTotal = new Set([...userKeywords, ...otherKeywords]).size;
    const score = uniqueTotal > 0 ? Math.round((matches / uniqueTotal) * 100) : 0;
    return score;
  };


  const searchUsers = async () => {
    const searchTerm = searchKeyword.trim();
    if (!searchTerm) {
      // If search is cleared, revert to synergy connections
      findSynergyConnections();
      return;
    }
     if (!currentUser) return;

    setSearchLoading(true);
    try {
        const connectionsQuery = query(
            collection(db, 'connections'),
            where('users', 'array-contains', currentUser.uid)
        );
        const connectionsSnapshot = await getDocs(connectionsQuery);
        const connectedUserIds = new Set<string>([currentUser.uid]);
        connectionsSnapshot.forEach(doc => {
            const data = doc.data();
            data.users.forEach((uid: string) => connectedUserIds.add(uid));
        });

        // --- Improved Search Logic ---
        // Instead of fetching all users, leverage Firestore queries if possible.
        // This example still fetches all for simplicity, but consider backend search (Algolia, etc.) for scale.
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);

        const searchLower = searchTerm.toLowerCase();
        const results: User[] = [];

        const userGoals = [...(activeGoals || []), ...(planningGoals || [])];
        const userKeywords = extractKeywords(userGoals.map(g => g.text));

        usersSnapshot.forEach((doc) => {
            const userData = doc.data() as User;
            const userUid = userData.uid;

            if (!userUid || connectedUserIds.has(userUid)) return;
            if (!userData.name) return;

            let matchFound = false;
            // Check name (exact start or contains)
            if (userData.name.toLowerCase().startsWith(searchLower) || userData.name.toLowerCase().includes(searchLower)) {
                matchFound = true;
            }
            // Check bio
            if (!matchFound && userData.bio?.toLowerCase().includes(searchLower)) {
                matchFound = true;
            }
            // Check goals
            if (!matchFound && (userData.goals || []).some(goal => goal.text.toLowerCase().includes(searchLower))) {
                matchFound = true;
            }
            // Check keywords (derived from goals) - less efficient client-side
            // if (!matchFound) {
            //    const otherKeywords = extractKeywords((userData.goals || []).map(g => g.text));
            //    if (otherKeywords.some(k => k.includes(searchLower))) {
            //        matchFound = true;
            //    }
            // }

            if (matchFound) {
                const otherUserKeywords = extractKeywords((userData.goals || []).map(g => g.text));
                const synergyScore = calculateSynergy(userKeywords, otherUserKeywords);
                results.push({
                    id: doc.id,
                    ...userData,
                    synergy: synergyScore,
                    keywords: otherUserKeywords
                });
            }
        });

        // Simple sort by synergy for search results too
        results.sort((a, b) => (b.synergy || 0) - (a.synergy || 0));

        console.log(`Search for "${searchTerm}" found ${results.length} potential users.`);
        setPotentialConnections(results);
        setTabView('discover');

        if (results.length === 0) {
             Alert.alert("No Results", `No users found matching "${searchTerm}".`);
         }

    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };


  useEffect(() => {
    if (currentUser) {
      if (tabView === 'discover') {
        // Only load synergy if search bar is empty
        if (!searchKeyword.trim()) {
            findSynergyConnections();
        } else {
            // If there's a search term, search results should already be loaded
            // or will be loaded by the search function. Avoid double loading.
            setLoading(false); // Ensure loading indicator is off
        }
      } else if (tabView === 'connections') {
        loadConnections();
      }
    } else {
      setPotentialConnections([]);
      setUserConnections([]);
      setConnectionProfiles({});
      setLoading(false);
    }
  }, [currentUser, tabView, searchKeyword]); // Rerun when user, tab, or searchKeyword changes


  // Render user card component
  const renderUserCard = ({ item }: { item: User }) => {
    if (!item?.name || !item.uid) return null;

    const activeGoal = (item.goals || []).find(g => g.isActive && g.alreadyDoing);
    const planningGoal = (item.goals || []).find(g => g.isActive && !g.alreadyDoing);
    const displayGoal = activeGoal || planningGoal || item.goals?.[0];

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => setSelectedUser(item)}
      >
        {/* ... (rest of user card content remains the same) ... */}
        <View style={styles.userCardHeader}>
  {item.photoURL ? (
    <Image 
      source={{ uri: item.photoURL }} 
      style={styles.userAvatar}
    />
  ) : (
    <View style={styles.userAvatar}>
      <Text style={styles.userAvatarText}>{item.name?.charAt(0).toUpperCase() || '?'}</Text>
    </View>
  )}
          <View style={styles.userCardInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            {item.displayLocation && (
              <Text style={styles.userLocation}>{item.displayLocation}</Text>
            )}
          </View>
          {typeof item.synergy === 'number' && (
              <View style={styles.synergyBadge}>
                <Text style={styles.synergyText}>{item.synergy}% match</Text>
              </View>
          )}
        </View>
        {item.bio && (
          <Text style={styles.userBio} numberOfLines={2}>{item.bio}</Text>
        )}
        {displayGoal && (
          <View style={[
            styles.goalItem,
            displayGoal.alreadyDoing ? styles.activeGoalItem : styles.planningGoalItem
          ]}>
            <Text style={styles.goalText} numberOfLines={1}>{displayGoal.text}</Text>
            <Text style={[
              styles.goalStatus,
              displayGoal.alreadyDoing ? styles.activeStatus : styles.planningStatus
            ]}>
              {displayGoal.alreadyDoing ? 'Doing' : 'Starting'}
            </Text>
          </View>
        )}
        {item.keywords && item.keywords.length > 0 && (
          <View style={styles.keywordsContainer}>
            {item.keywords.slice(0, 5).map((keyword, index) => (
              <View key={`${item.uid}-keyword-${index}`} style={styles.keywordChip}>
                <Text style={styles.keywordText}>{keyword}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={styles.connectButton}
          onPress={() => sendConnectionRequest(item.uid)}
        >
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };


  // Render connection item component
  const renderConnectionItem = ({ item }: { item: Connection }) => {
    const otherUserId = item.users.find(id => id !== currentUser?.uid);
    if (!otherUserId) return null;

     // Use UID which is the key in connectionProfiles
     const otherUser = connectionProfiles[otherUserId];
     // Show loading or placeholder if profile hasn't loaded yet
     if (!otherUser) {
         return (
            <View key={item.id || `loading-${otherUserId}`} style={styles.connectionItem}>
                <ActivityIndicator size="small"/>
                <Text style={{marginLeft: 10, color: '#A0AEC0'}}>Loading info...</Text>
            </View>
        );
     }


     const handlePress = () => {
      if (item.status === 'accepted') {
        console.log(`Navigating to messages. Connection ID: ${item.id}, Other User ID: ${otherUserId}`);
        if (!otherUserId || !item.id) {
          console.error("ERROR: Missing otherUserId or connectionId for navigation!");
          Alert.alert("Navigation Error", "Cannot open chat, required information is missing.");
          return;
        }
        router.push({
          pathname: '/messages',
          params: { connectionId: item.id, userId: otherUserId }
        });
      } else if (item.status === 'pending') {
             if (item.requestedBy !== currentUser?.uid) {
                  Alert.alert(
                    "Connection Request",
                    `${otherUser.name || 'Someone'} sent you a request.`,
                    [
                        { text: "Decline", onPress: () => declineConnectionRequest(item.id), style: "destructive" }, // Add decline function
                        { text: "Accept", onPress: () => acceptConnectionRequest(item.id) }
                    ]
                 );
             } else {
                 Alert.alert("Request Pending", `Your connection request to ${otherUser.name || 'this user'} is pending.`);
             }
         }
     };


    return (
      // Use item.id for the key here as it's the top-level element returned by the function used in .map
      <TouchableOpacity
  style={styles.connectionItem}
  onPress={handlePress}
>
  {otherUser?.photoURL ? (
    <Image 
      source={{uri: otherUser.photoURL}}
      style={styles.connectionAvatar}
    />
  ) : (
    <View style={styles.connectionAvatar}>
      <Text style={styles.connectionAvatarText}>{otherUser.name?.charAt(0).toUpperCase() || '?'}</Text>
    </View>
  )}
        <View style={styles.connectionInfo}>
            <Text style={styles.connectionName}>{otherUser.name || 'User'}</Text>
            {item.status === 'pending' ? (
                <Text style={styles.pendingStatusText}>
                    {item.requestedBy === currentUser?.uid ? 'Request Sent' : 'Request Received'}
                </Text>
            ) : (
                <Text style={styles.connectionLastMessage} numberOfLines={1}>
                    {item.lastMessage || 'No messages yet'}
                 </Text>
            )}
        </View>
        {/* Calculate unread count specific to current user */}
        {item.status === 'accepted' && item[`unreadCount_${currentUser?.uid}`] > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item[`unreadCount_${currentUser?.uid}`]}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

   // Function to accept a connection request
   const acceptConnectionRequest = async (connectionId: string) => {
       try {
           const connectionRef = doc(db, 'connections', connectionId);
           await updateDoc(connectionRef, {
               status: 'accepted',
               acceptedAt: new Date(),
               lastActivity: new Date() // Update activity on accept
           });
           Alert.alert("Connection Accepted", "You are now connected!");
           loadConnections(); // Refresh connections list
       } catch (error) {
           console.error("Error accepting connection:", error);
           Alert.alert("Error", "Could not accept the connection request.");
       }
   };

   // Function to decline a connection request
    const declineConnectionRequest = async (connectionId: string) => {
       try {
           const connectionRef = doc(db, 'connections', connectionId);
           // Option 1: Update status to 'declined' (keeps record)
           // await updateDoc(connectionRef, {
           //     status: 'declined',
           // });
           // Option 2: Delete the connection document entirely
           await deleteDoc(connectionRef);

           Alert.alert("Request Declined", "The connection request has been declined.");
           loadConnections(); // Refresh connections list
       } catch (error) {
           console.error("Error declining connection:", error);
           Alert.alert("Error", "Could not decline the connection request.");
       }
   };


  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Dark Space Header */}
<View style={[styles.headerContainer, { paddingTop: insets.top }]}>
  <LinearGradient
    colors={['#0f1729', '#1c2741', '#121a2c']}
    style={styles.headerGradient}
  >
    <StarryBackground />
    
    <View style={styles.headerContent}>
    <TouchableOpacity
  onPress={() => router.replace('/')}  // Always go back to home
  style={styles.backButton}
  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
>
  <Text style={styles.backButtonText}>←</Text>
</TouchableOpacity>

      <Text style={styles.headerTitle}>Circles</Text>
      <View style={{ width: 40 }} />{/* Placeholder */}
    </View>
  </LinearGradient>
</View>

      <View style={styles.tabs}>
  <TouchableOpacity
    style={[styles.tab, tabView === 'discover' && styles.activeTab]}
    onPress={() => setTabView('discover')}
  >
    <Text style={[
      styles.tabText,
      tabView === 'discover' && styles.activeTabText,
      {paddingHorizontal: 5} // Keep your padding fix
    ]}>Discover</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.tab, tabView === 'connections' && styles.activeTab]}
    onPress={() => setTabView('connections')}
  >
    <Text style={[
      styles.tabText,
      tabView === 'connections' && styles.activeTabText,
      {paddingHorizontal: 5} // Keep your padding fix
    ]}>Connections</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.tab, tabView === 'groups' && styles.activeTab]}
    onPress={() => setTabView('groups')}
  >
    <Text style={[
      styles.tabText,
      tabView === 'groups' && styles.activeTabText,
      {paddingHorizontal: 5} // Keep your padding fix
    ]}>Groups</Text>
  </TouchableOpacity>
</View>

      {/* --- Content Sections --- */}
      {tabView === 'discover' && (
        <View style={styles.content}>
          {/* ... (Search bar remains the same) ... */}
            <View style={styles.searchContainer}>
                <TextInput
                style={styles.searchInput}
                placeholder="Search name, bio, or focus area..."
                value={searchKeyword}
                onChangeText={setSearchKeyword} // Search triggers on text change via useEffect
                // onSubmitEditing={searchUsers} // Can keep if preferred
                returnKeyType="search"
                />
                {/* Removed explicit search button, search happens as user types / clears */}
                {/* Optionally add a clear button */}
                {searchKeyword.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchKeyword('')} style={styles.clearButton}>
                        <Text style={styles.clearButtonText}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {searchKeyword ? 'Search Results' : 'Suggested Connections'}
            </Text>
          </View>

          {loading || searchLoading ? (
             <View style={styles.loadingContainer}>
               <ActivityIndicator size="large" color="#4299E1" />
               <Text style={styles.loadingText}>{searchLoading ? 'Searching...' : 'Finding connections...'}</Text>
             </View>
           ) : potentialConnections.length > 0 ? (
            <FlatList
              data={potentialConnections}
              renderItem={renderUserCard}
              keyExtractor={(item) => item.uid} // Use UID as key
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.usersList}
              keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside input
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchKeyword
                  ? 'No users found matching your search.'
                  : 'No suggested connections found. Add more focus areas to see suggestions.'}
              </Text>
              {/* Button might not be needed if suggestions auto-update */}
            </View>
          )}
        </View>
      )}

      {tabView === 'connections' && (
        <View style={styles.content}>
          {loading ? (
             <View style={styles.loadingContainer}>
               <ActivityIndicator size="large" color="#4299E1" />
               <Text style={styles.loadingText}>Loading connections...</Text>
             </View>
           ) : userConnections.length > 0 ? (
            <ScrollView>
                 {/* Filter and map sections */}
                 {/* --- FIX: Added key={item.id} to each mapped item --- */}
                 {userConnections.filter(c => c.status === 'pending' && c.requestedBy !== currentUser?.uid).length > 0 && (
                     <View style={styles.subSection}>
                         <Text style={styles.subSectionTitle}>Requests Received</Text>
                         {userConnections
                             .filter(c => c.status === 'pending' && c.requestedBy !== currentUser?.uid)
                             .map(item => <View key={item.id}>{renderConnectionItem({ item })}</View>)}
                             {/* Alternative: Pass key directly if renderConnectionItem returns a single element with key */}
                             {/* .map(item => renderConnectionItem({ item, key: item.id }))} */}
                     </View>
                 )}
                 {userConnections.filter(c => c.status === 'accepted').length > 0 && (
                     <View style={styles.subSection}>
                         <Text style={styles.subSectionTitle}>Accepted Connections</Text>
                         {userConnections
                             .filter(c => c.status === 'accepted')
                             .map(item => <View key={item.id}>{renderConnectionItem({ item })}</View>)}
                     </View>
                 )}
                  {userConnections.filter(c => c.status === 'pending' && c.requestedBy === currentUser?.uid).length > 0 && (
                     <View style={styles.subSection}>
                         <Text style={styles.subSectionTitle}>Requests Sent</Text>
                         {userConnections
                             .filter(c => c.status === 'pending' && c.requestedBy === currentUser?.uid)
                             .map(item => <View key={item.id}>{renderConnectionItem({ item })}</View>)}
                     </View>
                 )}
             </ScrollView>
          ) : (
             <View style={styles.emptyContainer}>
               <Text style={styles.emptyText}>
                 No connections yet. Discover people in the Discover tab!
               </Text>
                 <TouchableOpacity
                    style={styles.addGoalButton} // Re-using button style
                    onPress={() => setTabView('discover')}
                 >
                    <Text style={styles.addGoalButtonText}>Discover Connections</Text>
                 </TouchableOpacity>
             </View>
          )}
        </View>
      )}

      {/* --- User Profile Modal --- */}
       {selectedUser && (
         <Modal
             visible={!!selectedUser}
             animationType="slide"
             transparent={true}
             onRequestClose={() => setSelectedUser(null)}
         >
             <TouchableOpacity
                 style={styles.userProfileModalOverlay}
                 activeOpacity={1}
                 onPressOut={() => setSelectedUser(null)}
             >
                 <View style={styles.userProfileModalContent} onStartShouldSetResponder={() => true}>
                      {/* Prevent closing when touching inside content */}
                     <ScrollView>
                         {/* ... (Modal Header, About, Focus Areas, Keywords remain the same) ... */}
                         <View style={styles.userProfileHeader}>
  {selectedUser.photoURL ? (
    <Image 
      source={{ uri: selectedUser.photoURL }} 
      style={styles.userProfileAvatar}
    />
  ) : (
    <View style={styles.userProfileAvatar}>
      <Text style={styles.userProfileAvatarText}>{selectedUser.name?.charAt(0).toUpperCase() || '?'}</Text>
    </View>
  )}
  <Text style={styles.userProfileName}>{selectedUser.name}</Text>
  {selectedUser.displayLocation && (
    <Text style={styles.userProfileLocation}>{selectedUser.displayLocation}</Text>
  )}
  {typeof selectedUser.synergy === 'number' && (
    <View style={styles.synergyBadgeLarge}>
      <Text style={styles.synergyTextLarge}>{selectedUser.synergy}% Synergy Match</Text>
    </View>
                             )}
                         </View>

                         <View style={styles.userProfileSection}>
                             <Text style={styles.userProfileSectionTitle}>About</Text>
                             <Text style={styles.userProfileBio}>{selectedUser.bio || 'No bio provided.'}</Text>
                         </View>

                         {selectedUser.goals && selectedUser.goals.length > 0 && (
                             <View style={styles.userProfileSection}>
                                 <Text style={styles.userProfileSectionTitle}>Focus Areas</Text>
                                 {selectedUser.goals
                                      .filter(goal => goal.isActive)
                                      .sort((a, b) => (a.alreadyDoing === b.alreadyDoing) ? 0 : a.alreadyDoing ? -1 : 1)
                                      .map((goal) => ( // No index needed if goal.id is reliable
                                     <View
                                         key={goal.id} // Use goal.id as key
                                         style={[
                                             styles.userProfileGoal,
                                             goal.alreadyDoing ? styles.userProfileActiveGoal : styles.userProfilePlanningGoal
                                         ]}
                                     >
                                         <Text style={styles.userProfileGoalText}>{goal.text}</Text>
                                         <Text style={[
                                             styles.userProfileGoalStatus,
                                             goal.alreadyDoing ? styles.userProfileActiveStatus : styles.userProfilePlanningStatus
                                         ]}>
                                             {goal.alreadyDoing ? 'Doing' : 'Starting'}
                                         </Text>
                                     </View>
                                 ))}
                             </View>
                         )}

                         {selectedUser.keywords && selectedUser.keywords.length > 0 && (
                             <View style={styles.userProfileSection}>
                                 <Text style={styles.userProfileSectionTitle}>Matching Keywords</Text>
                                 <View style={styles.userProfileKeywords}>
                                     {selectedUser.keywords.map((keyword, index) => (
                                         <View key={`${selectedUser.uid}-modal-keyword-${index}`} style={styles.userProfileKeywordChip}>
                                             <Text style={styles.userProfileKeywordText}>{keyword}</Text>
                                         </View>
                                     ))}
                                 </View>
                             </View>
                         )}

                         <View style={styles.userProfileButtons}>
                             <TouchableOpacity
                                 style={styles.userProfileConnectButton}
                                 onPress={() => {
                                     sendConnectionRequest(selectedUser.uid);
                                     setSelectedUser(null);
                                 }}
                             >
                                 <Text style={styles.userProfileConnectButtonText}>Send Connection Request</Text>
                             </TouchableOpacity>
                         </View>
                     </ScrollView>

                     <TouchableOpacity
                         style={styles.modalCloseButton}
                         onPress={() => setSelectedUser(null)}
                     >
                         <Text style={styles.modalCloseButtonText}>✕</Text>
                     </TouchableOpacity>
                 </View>
             </TouchableOpacity>
         </Modal>
      )}
{tabView === 'groups' && (
  <View style={styles.content}>
    <View style={styles.groupsHeader}>
      <Text style={styles.sectionTitle}>Your Groups</Text>
      <TouchableOpacity 
        style={styles.createGroupButton}
        onPress={() => router.push('/circles/create-group')}
      >
        <Text style={styles.createGroupButtonText}>Create Group</Text>
      </TouchableOpacity>
    </View>
    
    {loadingGroups ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    ) : userGroups.length > 0 ? (
      <FlatList
        data={userGroups}
        renderItem={renderGroupItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.groupsList}
      />
    ) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          You're not part of any groups yet. Create a group or get invited to join one!
        </Text>
        <TouchableOpacity
          style={styles.createGroupButtonLarge}
          onPress={() => router.push('/circles/create-group')}
        >
          <Text style={styles.createGroupButtonTextLarge}>Create a Group</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
)}
    </View>
  );
}

// --- Styles ---
// Add styles for clearButton, adjust others as needed
const styles = StyleSheet.create({
  // ... (Keep existing styles: container, header, backButton, title, tabs, content etc.)
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
     zIndex: 10,
  },
  backButton: {
     padding: 8,
     marginRight: 12,
     zIndex: 20,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1D1E',
     textAlign: 'center',
     flex: 1
  },
    tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4299E1',
  },
  tabText: {
    fontSize: 16,
    color: '#718096',
  },
  activeTabText: {
    color: '#4299E1',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
     borderBottomWidth: 1,
     borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    // marginRight: 8, // Remove margin if clear button is inside or not present
     fontSize: 15,
  },
    clearButton: { // Style for the clear search text 'X' button
        padding: 8,
        position: 'absolute', // Position inside the TextInput area
        right: 16, // Adjust as needed
        alignSelf: 'center', // Vertically center
    },
    clearButtonText: {
        fontSize: 18,
        color: '#999', // Light gray color for 'X'
    },
//   searchButton: { // Removed as search is triggered by text change
//     backgroundColor: '#4299E1',
//     paddingHorizontal: 14,
//     paddingVertical: 10,
//     borderRadius: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   searchButtonText: {
//     color: 'white',
//     fontWeight: '600',
//      fontSize: 15,
//   },
  sectionHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F7FAFC',
     borderBottomWidth: 1,
     borderBottomColor: '#E2E8F0',
  },
   subSection: {
     marginBottom: 0, // Remove bottom margin if sections are directly stacked
   },
   subSectionTitle: {
     fontSize: 14, // Smaller title for subsections
     fontWeight: 'bold', // Bolder
     textTransform: 'uppercase', // Uppercase
     letterSpacing: 0.5, // Add letter spacing
     color: '#4A5568',
     paddingHorizontal: 16,
     paddingVertical: 12, // More vertical padding
     backgroundColor: '#EDF2F7',
   },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3748',
  },
   clearSearchText: { // No longer needed if search is auto-cleared
     /* fontSize: 14,
     color: '#4299E1',
     fontWeight: '500', */
   },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
     marginTop: 30,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#718096',
  },
  usersList: {
    paddingVertical: 16,
     paddingHorizontal: 16,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
     shadowColor: "#000",
     shadowOffset: { width: 0, height: 1 },
     shadowOpacity: 0.05,
     shadowRadius: 2,
     elevation: 1,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
  },
  userCardInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3748',
     marginBottom: 2,
  },
  userLocation: {
    fontSize: 13,
    color: '#718096',
  },
  synergyBadge: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
     marginLeft: 8,
  },
  synergyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2B6CB0',
  },
  userBio: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 12,
     lineHeight: 19,
  },
  goalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
     paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
     marginTop: 4,
  },
  activeGoalItem: {
    backgroundColor: '#F0FFF4',
     borderLeftWidth: 3,
     borderLeftColor: '#38B2AC',
  },
  planningGoalItem: {
    backgroundColor: '#EBF8FF',
     borderLeftWidth: 3,
     borderLeftColor: '#4299E1',
  },
  goalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D3748',
    flex: 1,
     marginRight: 8,
  },
  goalStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeStatus: {
    color: '#2F855A',
  },
  planningStatus: {
    color: '#2B6CB0',
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
  },
  keywordChip: {
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  keywordText: {
    fontSize: 12,
    color: '#4A5568',
  },
  connectButton: {
    backgroundColor: '#4299E1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
     marginTop: 8,
  },
  connectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30, // More horizontal padding
    paddingBottom: 50, // Push content up a bit
  },
  emptyText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22, // Improve readability
  },
  addGoalButton: {
    backgroundColor: '#4299E1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addGoalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  connectionsList: { // Style for the ScrollView content if needed
    paddingBottom: 20, // Ensure space at the bottom
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12, // Vertical padding
    paddingHorizontal: 16, // Horizontal padding
    // borderRadius: 12, // Remove border radius for cleaner list look?
    // marginBottom: 12, // Remove margin, use border instead
    borderBottomWidth: 1, // Use border bottom separator
    borderBottomColor: '#E2E8F0',
  },
  connectionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  connectionAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  connectionLastMessage: {
    fontSize: 14,
    color: '#718096',
  },
   pendingStatusText: {
     fontSize: 14,
     fontStyle: 'italic',
     color: '#A0AEC0',
   },
  unreadBadge: {
    backgroundColor: '#4299E1',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
     paddingHorizontal: 5,
     marginLeft: 8, // Add margin to separate from text
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
   userProfileModalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.6)',
     justifyContent: 'center',
     alignItems: 'center',
   },
   userProfileModalContent: {
     backgroundColor: 'white',
     borderRadius: 12,
     width: '90%',
     maxHeight: '80%',
     padding: 0,
     overflow: 'hidden',
     position: 'relative',
     shadowColor: "#000",
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.25,
     shadowRadius: 4,
     elevation: 5,
   },
  userProfileHeader: {
    alignItems: 'center',
     paddingTop: 30, // More padding top
     paddingBottom: 20, // More padding bottom
     paddingHorizontal: 20,
     borderBottomWidth: 1,
     borderBottomColor: '#E2E8F0',
     backgroundColor: '#F8F9FA', // Slight background tint
  },
  userProfileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2, // Add border
    borderColor: 'white', // White border
  },
  userProfileAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#4A5568',
  },
  userProfileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  userProfileLocation: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 12,
  },
  synergyBadgeLarge: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BEE3F8', // Light blue border
  },
  synergyTextLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B6CB0',
  },
  userProfileSection: {
     paddingVertical: 15, // Consistent vertical padding
     paddingHorizontal: 20,
  },
  userProfileSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold', // Bold
    color: '#2D3748',
    marginBottom: 12, // Increase margin
    textTransform: 'uppercase', // Uppercase Title
    letterSpacing: 0.5, // Add spacing
  },
  userProfileBio: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
  },
  userProfileGoal: {
    borderRadius: 8,
    paddingVertical: 10,
     paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row', // Align status text better
    justifyContent: 'space-between', // Align status text better
    alignItems: 'center', // Align status text better
  },
  userProfileActiveGoal: {
    backgroundColor: '#F0FFF4',
    borderLeftWidth: 3,
    borderLeftColor: '#38B2AC',
  },
  userProfilePlanningGoal: {
    backgroundColor: '#EBF8FF',
    borderLeftWidth: 3,
    borderLeftColor: '#4299E1',
  },
  userProfileGoalText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D3748',
    // marginBottom: 4, // Remove margin if status is beside
    flex: 1, // Allow text to take space
    marginRight: 10, // Space before status
  },
  userProfileGoalStatus: {
    fontSize: 12, // Smaller status text
    fontWeight: '600', // Bolder status
    paddingHorizontal: 6, // Padding for status badge
    paddingVertical: 2, // Padding for status badge
    borderRadius: 4, // Rounded status badge
    overflow: 'hidden', // Ensure background clips
  },
  userProfileActiveStatus: {
    color: '#2F855A', // Dark green text
    backgroundColor: '#C6F6D5', // Light green background
  },
  userProfilePlanningStatus: {
    color: '#2B6CB0', // Dark blue text
    backgroundColor: '#BEE3F8', // Light blue background
  },
  userProfileKeywords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  userProfileKeywordChip: {
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userProfileKeywordText: {
    fontSize: 13,
    color: '#4A5568',
  },
  userProfileButtons: {
     paddingHorizontal: 20,
     paddingVertical: 20, // More padding
     borderTopWidth: 1,
     borderTopColor: '#E2E8F0',
     marginTop: 0, // Remove margin if section padding exists
     backgroundColor: '#F8F9FA', // Slight background tint for button area
  },
  userProfileConnectButton: {
    backgroundColor: '#4299E1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
     shadowColor: "#000", // Add shadow to button
     shadowOffset: { width: 0, height: 1 },
     shadowOpacity: 0.1,
     shadowRadius: 2,
     elevation: 2,
  },
  userProfileConnectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
   modalCloseButton: {
     position: 'absolute',
     top: 12, // Adjust position
     right: 12, // Adjust position
     backgroundColor: 'rgba(0, 0, 0, 0.1)', // Semi-transparent background
     width: 32,
     height: 32,
     borderRadius: 16,
     alignItems: 'center',
     justifyContent: 'center',
     zIndex: 50,
   },
   modalCloseButtonText: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#4A5568', // Darker X
   },
   // Add to your StyleSheet:
groupsHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: 'white',
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
},
createGroupButton: {
  backgroundColor: '#4299E1',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},
createGroupButtonText: {
  color: 'white',
  fontWeight: '600',
  fontSize: 14,
},
groupsList: {
  padding: 16,
},
groupItem: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'white',
  padding: 16,
  borderRadius: 12,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
groupAvatar: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: '#4299E1',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 14,
},
groupAvatarText: {
  fontSize: 20,
  fontWeight: 'bold',
  color: 'white',
},
groupInfo: {
  flex: 1,
},
groupName: {
  fontSize: 16,
  fontWeight: '600',
  color: '#2D3748',
  marginBottom: 4,
},
groupMembersCount: {
  fontSize: 14,
  color: '#718096',
},
createGroupButtonLarge: {
  backgroundColor: '#4299E1',
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 8,
  marginTop: 16,
},
createGroupButtonTextLarge: {
  color: 'white',
  fontSize: 16,
  fontWeight: '600',
},
headerContainer: {
  overflow: 'hidden',
  borderBottomLeftRadius: 16,
  borderBottomRightRadius: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 5,
},
headerGradient: {
  paddingTop: 10,
  paddingBottom: 16,
  position: 'relative',
  overflow: 'hidden',
},
headerContent: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  position: 'relative',
  zIndex: 2,
},
headerTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#FFFFFF',
  textShadowColor: 'rgba(59, 130, 246, 0.8)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 8,
},
backButtonText: {
  fontSize: 24,
  color: '#FFFFFF',
  fontWeight: 'bold',
},
editButton: {
  position: 'absolute',
  right: 16, 
  top: 16,
  backgroundColor: 'rgba(66, 153, 225, 0.1)',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 5,
},
editButtonText: {
  color: '#4299E1',
  fontWeight: '600',
  fontSize: 12,
}
});