import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import * as ImagePicker from 'expo-image-picker';

// Types
interface User {
  id?: string;
  uid: string;
  name: string;
  email?: string;
}

// Function to upload a group profile image to ImgBB
const uploadGroupProfileImage = async (uri: string) => {
  const IMGBB_API_KEY = "1620338bf14efdbb8df4d547343a9365";
  
  try {
    // First, convert the image to base64
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Convert blob to base64
    const base64Promise = new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64data = reader.result as string;
        // Get only the base64 part (remove the prefix)
        const base64Image = base64data.split(',')[1];
        resolve(base64Image);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file as base64"));
      };
      reader.readAsDataURL(blob);
    });
    
    const base64Image = await base64Promise;
    
    // Create form data for ImgBB API
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64Image);
    
    console.log("Uploading group image to ImgBB...");
    
    // Upload to ImgBB
    const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });
    
    const result = await uploadResponse.json();
    
    if (result.success) {
      console.log("Group image upload successful:", result.data.url);
      return result.data.display_url;
    } else {
      console.error("ImgBB upload failed:", result.error);
      throw new Error(result.error?.message || "Upload failed");
    }
  } catch (error) {
    console.error("Error in group image upload process:", error);
    throw error;
  }
};

export default function CreateGroupScreen() {
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [connections, setConnections] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [groupPhotoURL, setGroupPhotoURL] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Pick a group image from the gallery
  const pickGroupImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to add a group photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setIsUploadingPhoto(true);

        try {
          const imageUrl = await uploadGroupProfileImage(result.assets[0].uri);
          setGroupPhotoURL(imageUrl);
        } catch (error) {
          console.error('Error updating group profile picture:', error);
          Alert.alert('Error', 'Failed to upload group profile picture. Please try again.');
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Error picking image for group:', error);
      Alert.alert('Error', 'An error occurred while selecting an image.');
      setIsUploadingPhoto(false);
    }
  };

  // Load the user's connections
  useEffect(() => {
    if (!currentUser) {
      router.replace('/');
      return;
    }

    const loadConnections = async () => {
      setLoading(true);
      try {
        // Query for accepted connections
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('users', 'array-contains', currentUser.uid),
          where('status', '==', 'accepted')
        );
        
        const connectionsSnapshot = await getDocs(connectionsQuery);
        const userIds: string[] = [];
        
        connectionsSnapshot.forEach(doc => {
          const data = doc.data();
          // Find the other user in each connection
          const otherUserId = data.users.find((id: string) => id !== currentUser.uid);
          if (otherUserId) {
            userIds.push(otherUserId);
          }
        });
        
        // If there are connections, load user details
        if (userIds.length > 0) {
          const users: User[] = [];
          // Batch in groups of 10 (Firestore limit for 'in' queries)
          for (let i = 0; i < userIds.length; i += 10) {
            const batch = userIds.slice(i, i + 10);
            const usersQuery = query(
              collection(db, 'users'),
              where('uid', 'in', batch)
            );
            
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach(doc => {
              const userData = doc.data();
              users.push({
                id: doc.id,
                uid: userData.uid,
                name: userData.name,
                email: userData.email
              });
            });
          }
          
          setConnections(users);
        }
      } catch (error) {
        console.error('Error loading connections:', error);
        Alert.alert('Error', 'Failed to load your connections.');
      } finally {
        setLoading(false);
      }
    };
    
    loadConnections();
  }, [currentUser]);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Create the group
  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one connection to add to the group.');
      return;
    }
    
    setCreating(true);
    try {
      // Create a new group document
      const groupRef = doc(collection(db, 'groups'));
      const groupId = groupRef.id;
      
      // All selected users plus the current user
      const memberIds = [currentUser.uid, ...selectedUsers];
      
      // Create the group members array
      const members = memberIds.map(uid => ({
        userId: uid,
        role: uid === currentUser.uid ? 'admin' : 'member',
        joinedAt: new Date()
      }));
      
      // Set the group data
      await setDoc(groupRef, {
        id: groupId,
        name: groupName.trim(),
        description: groupDescription.trim(),
        createdBy: currentUser.uid,
        createdAt: new Date(),
        isPublic: false,
        members,
        lastMessage: null,
        photoURL: groupPhotoURL // Add the photo URL to the document
      });
      
      Alert.alert('Success', 'Group created successfully!');
      router.back(); // Return to the groups tab
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create the group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Group Details</Text>
          
          {/* Group Photo Selector */}
          <View style={styles.photoContainer}>
            <Text style={styles.inputLabel}>Group Photo (Optional)</Text>
            <TouchableOpacity 
              style={styles.photoSelector}
              onPress={pickGroupImage}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="large" color="#4299E1" />
              ) : groupPhotoURL ? (
                <Image source={{ uri: groupPhotoURL }} style={styles.groupPhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>+</Text>
                  <Text style={styles.photoPlaceholderLabel}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.inputLabel}>Group Name*</Text>
          <TextInput
            style={styles.textInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter a name for your group"
            maxLength={50}
          />
          
          <Text style={styles.inputLabel}>Description (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={groupDescription}
            onChangeText={setGroupDescription}
            placeholder="What's this group about?"
            multiline={true}
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Add Members</Text>
          <Text style={styles.sectionDescription}>
            Select connections to add to this group:
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#4299E1" style={styles.loader} />
          ) : connections.length > 0 ? (
            connections.map(user => (
              <TouchableOpacity 
                key={user.uid}
                style={[
                  styles.userItem,
                  selectedUsers.includes(user.uid) && styles.selectedUserItem
                ]}
                onPress={() => toggleUserSelection(user.uid)}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.checkBox}>
                  {selectedUsers.includes(user.uid) && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noConnectionsText}>
              You don't have any connections yet. Connect with people first!
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (!groupName.trim() || selectedUsers.length === 0) && styles.disabledButton
          ]}
          onPress={createGroup}
          disabled={!groupName.trim() || selectedUsers.length === 0 || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#4A5568',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1D1E',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  formSection: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A5568',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectedUserItem: {
    backgroundColor: '#EBF8FF',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
    flex: 1,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#CBD5E0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: '#4299E1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noConnectionsText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    padding: 20,
  },
  loader: {
    marginVertical: 20,
  },
  footer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  createButton: {
    backgroundColor: '#4299E1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CBD5E0',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // New styles for photo selection
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoSelector: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  photoPlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#CBD5E0',
  },
  photoPlaceholderLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  groupPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
});