import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import * as ImagePicker from 'expo-image-picker';

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

export default function EditGroupScreen() {
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const groupId = params.groupId as string;
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  // Load group details
  useEffect(() => {
    if (!currentUser || !groupId) {
      router.replace('/circles');
      return;
    }

    const loadGroupDetails = async () => {
      setLoading(true);
      try {
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);
        
        if (!groupDoc.exists()) {
          Alert.alert('Error', 'Group not found');
          router.back();
          return;
        }
        
        const groupData = groupDoc.data();
        
        // Store original members for later use
        setMembers(groupData.members || []);
        
        // Check if current user is an admin
        const userMember = groupData.members.find(
          (member: any) => member.userId === currentUser.uid
        );
        
        const userRole = userMember?.role;
        
        setIsAdmin(userRole === 'admin');
        
        // If not admin, show view-only version or redirect
        if (userRole !== 'admin') {
          Alert.alert('Access Denied', 'Only group admins can edit group details');
          router.back();
          return;
        }
        
        setGroupName(groupData.name || '');
        setGroupDescription(groupData.description || '');
        setPhotoURL(groupData.photoURL || null);
        
      } catch (error) {
        console.error('Error loading group details:', error);
        Alert.alert('Error', 'Failed to load group details');
      } finally {
        setLoading(false);
      }
    };
    
    loadGroupDetails();
  }, [currentUser, groupId]);

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
          setPhotoURL(imageUrl);
          
          // Immediately update the group document with the new photo URL
          // This ensures all members can see it right away
          const groupRef = doc(db, 'groups', groupId);
          await updateDoc(groupRef, {
            photoURL: imageUrl,
            lastUpdated: serverTimestamp()
          });
          
          Alert.alert('Success', 'Group photo updated successfully!');
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

  // Save group changes
  const saveGroupChanges = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    
    setSaving(true);
    try {
      const groupRef = doc(db, 'groups', groupId);
      
      // Get the current group data to preserve other fields
      const groupDoc = await getDoc(groupRef);
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const currentGroupData = groupDoc.data();
      
      await updateDoc(groupRef, {
        name: groupName.trim(),
        description: groupDescription.trim(),
        // Keep the existing photoURL if it wasn't updated
        photoURL: photoURL,
        // Make sure we're not overwriting any existing fields
        members: members,
        lastUpdated: serverTimestamp()
      });
      
      Alert.alert('Success', 'Group details updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating group:', error);
      Alert.alert('Error', 'Failed to update group details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

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
        <Text style={styles.title}>Edit Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Group Details</Text>
          
          {/* Group Photo Selector */}
          <View style={styles.photoContainer}>
            <Text style={styles.inputLabel}>Group Photo</Text>
            <TouchableOpacity 
              style={styles.photoSelector}
              onPress={pickGroupImage}
              disabled={isUploadingPhoto || !isAdmin}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="large" color="#4299E1" />
              ) : photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.groupPhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>+</Text>
                  <Text style={styles.photoPlaceholderLabel}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {photoURL && (
              <Text style={styles.photoInfoText}>
                Photo is visible to all group members
              </Text>
            )}
          </View>
          
          <Text style={styles.inputLabel}>Group Name*</Text>
          <TextInput
            style={styles.textInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter a name for your group"
            maxLength={50}
            editable={isAdmin}
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
            editable={isAdmin}
          />
        </View>

        {isAdmin && (
          <View style={styles.formSection}>
            <Text style={styles.sectionDescription}>
              Note: Other group settings like membership are managed through the group chat page.
            </Text>
          </View>
        )}
      </ScrollView>

      {isAdmin && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !groupName.trim() && styles.disabledButton
            ]}
            onPress={saveGroupChanges}
            disabled={!groupName.trim() || saving || isUploadingPhoto}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 10,
    color: '#718096',
    fontSize: 16,
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
  footer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saveButton: {
    backgroundColor: '#4299E1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CBD5E0',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Photo styling
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
  photoInfoText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
  },
});