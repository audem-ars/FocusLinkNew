import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { auth, storage } from '../../src/config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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

  return <>{stars}</>;
};

// Interfaces
interface Goal {
  id: string;
  text: string;
  isActive: boolean;
  alreadyDoing: boolean;
  createdAt?: string;
}

interface Settings {
  shareLocation: boolean;
  publicProfile: boolean;
  principleMode: string;
}

interface User {
  name: string;
  bio: string;
  email: string;
  goals: Goal[];
  savedPrinciples: string[];
  settings: Settings;
  photoURL?: string | null;
}

interface DraggableGoalCardProps {
  goal: Goal;
  onDelete: (goalId: string) => Promise<void>;
  onToggleActive: (goalId: string) => Promise<void>;
  onToggleStatus: (goalId: string) => Promise<void>;
  onDragEnd: () => void;
  onDragStart?: () => void;
}

type GestureContext = {
  translateX: number;
  translateY: number;
};

// DraggableGoalCard Component
const DraggableGoalCard: React.FC<DraggableGoalCardProps> = ({
  goal,
  onDelete,
  onToggleActive,
  onToggleStatus,
  onDragEnd,
  onDragStart
}) => {
  return (
    <View
      style={[
        styles.goalCard,
        goal.alreadyDoing ? styles.doingGoalCard : styles.planningGoalCard
      ]}
    >
      <View style={styles.goalCardHeader}>
        <Text style={styles.goalCardText}>{goal.text}</Text>
        {goal.alreadyDoing ? (
          <View style={[styles.badge, styles.doingBadge]}>
            <Text style={styles.badgeText}>Doing</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.planningBadge]}>
            <Text style={styles.badgeText}>Starting</Text>
          </View>
        )}
      </View>

      <View style={styles.goalCardActions}>
        <TouchableOpacity
          style={[
            styles.goalAction,
            goal.isActive ? styles.activeGoalAction : styles.inactiveGoalAction
          ]}
          onPress={() => onToggleActive(goal.id)}
        >
          <Text
            style={[
              styles.goalActionText,
              goal.isActive ? styles.activeGoalActionText : styles.inactiveGoalActionText
            ]}
          >
            {goal.isActive ? 'Active' : 'Inactive'}
          </Text>
        </TouchableOpacity>

        {goal.alreadyDoing ? (
          <TouchableOpacity
            style={[styles.goalAction, styles.planningGoalAction]}
            onPress={() => onToggleStatus(goal.id)}
          >
            <Text style={styles.planningGoalActionText}>Move to Starting</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.goalAction, styles.doButton]}
            onPress={() => onToggleStatus(goal.id)}
          >
            <Text style={styles.doButtonText}>DO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.goalAction, styles.deleteGoalAction]}
          onPress={() => onDelete(goal.id)}
        >
          <Text style={styles.deleteGoalActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function ProfileScreen() {
  const { currentUser, userProfile, logout, updateUserProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [goalsFilter, setGoalsFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);

  const uploadProfileImage = async (uri: string): Promise<string> => {
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    const IMGBB_API_KEY = "1620338bf14efdbb8df4d547343a9365"; // Your API key
    
    try {
      // First, convert the image to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert blob to base64
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64data = reader.result as string;
          // Get only the base64 part (remove the prefix like "data:image/jpeg;base64,")
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
      
      console.log("Uploading to ImgBB...");
      
      // Upload to ImgBB
      const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await uploadResponse.json();
      console.log("ImgBB API response:", result);
      
      if (result.success) {
        console.log("Upload successful:", result.data.url);
        
        // Update user profile with the new image URL
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, {
            photoURL: result.data.display_url
          });
          
          // Update Firestore profile
          await updateUserProfile({
            photoURL: result.data.display_url
          });
        }
        
        return result.data.display_url;
      } else {
        console.error("ImgBB upload failed:", result.error);
        throw new Error(result.error?.message || "Upload failed");
      }
    } catch (error) {
      console.error("Error in upload process:", error);
      throw error;
    }
  };

  const pickImage = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
  
      if (!result.canceled && result.assets && result.assets[0].uri) {
        setIsImageUploading(true);
  
        try {
          console.log("Starting upload process with ImgBB...");
          const imageUrl = await uploadProfileImage(result.assets[0].uri);
          console.log("Received image URL:", imageUrl);
  
          // Update local state
          if (imageUrl) {
            setUser((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                photoURL: imageUrl
              };
            });
          }
  
          Alert.alert('Success', 'Profile picture updated!');
        } catch (error) {
          console.error('Error updating profile picture:', error);
          Alert.alert('Error', 'Failed to update profile picture. Please try again.');
        } finally {
          setIsImageUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'An error occurred while selecting an image.');
      setIsImageUploading(false);
    }
  };

  const updateDisplayName = async (newName: string) => {
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newName
        });
        console.log("Display name updated successfully");
      }
    } catch (error) {
      console.error("Error updating display name:", error);
      throw error;
    }
  };

  useEffect(() => {
    console.log("Profile screen - Auth check", {currentUser, userProfile});

    if (initializing) {
      setInitializing(false);
      return;
    }

    if (!currentUser) {
      console.log("No current user, redirecting to login");
      router.replace('/login');
      return;
    }

    // Construct user data
    const userData: User = {
      name: currentUser.displayName || userProfile?.name || 'User',
      bio: userProfile?.bio || '',
      email: currentUser.email || '',
      goals: userProfile?.goals || [],
      savedPrinciples: userProfile?.savedPrinciples || [],
      settings: {
        shareLocation: userProfile?.settings?.shareLocation ?? true,
        publicProfile: userProfile?.settings?.publicProfile ?? true,
        principleMode: userProfile?.settings?.principleMode || 'random'
      },
      photoURL: currentUser.photoURL || userProfile?.photoURL || null
    };

    console.log("Setting user data", userData);
    setUser(userData);
    setEditName(userData.name);
    setEditBio(userData.bio);
    setIsLoading(false);
  }, [currentUser, userProfile, initializing]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to log out. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation Error", "Name cannot be empty.");
      return;
    }
    
    setIsLoading(true);
    try {
      const nameChanged = auth.currentUser && auth.currentUser.displayName !== editName.trim();
      const profileDataChanged = user && (user.name !== editName.trim() || user.bio !== editBio.trim());

      if (nameChanged) {
        await updateDisplayName(editName.trim());
      }

      if (profileDataChanged) {
        await updateUserProfile({
          name: editName.trim(),
          bio: editBio.trim()
        });
      }

      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          name: editName.trim(),
          bio: editBio.trim(),
          photoURL: auth.currentUser?.photoURL || prev.photoURL
        };
      });

      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSetting = async (setting: keyof Settings) => {
    if (!user) return;
    const currentSettings = user.settings || { shareLocation: true, publicProfile: true, principleMode: 'random' };
    const newSettings = {
      ...currentSettings,
      [setting]: !currentSettings[setting]
    };
    try {
      setUser(prev => prev ? { ...prev, settings: newSettings } : null);
      await updateUserProfile({ settings: newSettings });
    } catch (error) {
      console.error("Settings update error:", error);
      setUser(prev => prev ? { ...prev, settings: currentSettings } : null);
      Alert.alert("Error", "Failed to update settings. Please try again.");
    }
  };

  const updatePrincipleMode = async (mode: string) => {
    if (!user || user.settings?.principleMode === mode) return;
    const currentSettings = user.settings || { shareLocation: true, publicProfile: true, principleMode: 'random' };
    const newSettings = { ...currentSettings, principleMode: mode };
    try {
      setUser(prev => prev ? { ...prev, settings: newSettings } : null);
      await updateUserProfile({ settings: newSettings });
    } catch (error) {
      console.error("Principle mode update error:", error);
      setUser(prev => prev ? { ...prev, settings: currentSettings } : null);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this focus area?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const originalGoals = user.goals || [];
            const updatedGoals = originalGoals.filter(goal => goal.id !== goalId);
            setUser(prev => prev ? { ...prev, goals: updatedGoals } : null);
            try {
              await updateUserProfile({ goals: updatedGoals });
            } catch (error) {
              console.error("Goal deletion error:", error);
              setUser(prev => prev ? { ...prev, goals: originalGoals } : null);
              Alert.alert("Error", "Failed to delete focus area.");
            }
          }
        }
      ]
    );
  };

  const handleToggleGoalActive = async (goalId: string) => {
    if (!user) return;
    const originalGoals = user.goals || [];
    const updatedGoals = originalGoals.map(goal =>
      goal.id === goalId ? { ...goal, isActive: !goal.isActive } : goal
    );
    try {
      setUser(prev => prev ? { ...prev, goals: updatedGoals } : null);
      await updateUserProfile({ goals: updatedGoals });
    } catch (error) {
      console.error("Goal activation error:", error);
      setUser(prev => prev ? { ...prev, goals: originalGoals } : null);
      Alert.alert("Error", "Failed to toggle focus area activity.");
    }
  };

  const handleToggleGoalStatus = async (goalId: string) => {
    if (!user) return;
    const originalGoals = user.goals || [];
    const updatedGoals = originalGoals.map(goal =>
      goal.id === goalId ? { ...goal, alreadyDoing: !goal.alreadyDoing } : goal
    );
    try {
      setUser(prev => prev ? { ...prev, goals: updatedGoals } : null);
      await updateUserProfile({ goals: updatedGoals });
    } catch (error) {
      console.error('ERROR updating goal status:', error);
      setUser(prev => prev ? { ...prev, goals: originalGoals } : null);
      Alert.alert("Error", "Failed to update focus status. Please try again.");
    }
  };

  if (isLoading && !user) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Could not load profile data or user not logged in.</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      {isEditing ? (
        <>
          {/* Avatar Section in Edit Mode */}
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={pickImage}
            disabled={isLoading || isImageUploading}
          >
            {user.photoURL || currentUser?.photoURL ? (
              <Image
                source={{ uri: user.photoURL || currentUser?.photoURL || undefined }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{editName?.charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarText}>+</Text>
            </View>
            {isImageUploading && <ActivityIndicator size="large" color="#FFF" style={styles.avatarLoadingIndicator} />}
          </TouchableOpacity>

          <View style={styles.formField}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="#A0AEC0"
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell others about yourself"
              placeholderTextColor="#A0AEC0"
              multiline
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setIsEditing(false);
                setEditName(user.name);
                setEditBio(user.bio);
              }}
              disabled={isLoading || isImageUploading}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSaveProfile}
              disabled={isLoading || isImageUploading}
            >
              {isLoading && !isImageUploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={pickImage}
              disabled={isLoading || isImageUploading}
            >
              {user.photoURL || currentUser?.photoURL ? (
                <Image
                  source={{ uri: user.photoURL || currentUser?.photoURL || undefined }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}
              <View style={styles.editAvatarBadge}>
                <Text style={styles.editAvatarText}>+</Text>
              </View>
              {isImageUploading && <ActivityIndicator size="large" color="#FFF" style={styles.avatarLoadingIndicator} />}
            </TouchableOpacity>

            <Text style={styles.name}>{user.name}</Text>
            {user.email && <Text style={styles.email}>{user.email}</Text>}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{user.bio || "No bio provided."}</Text>
          </View>

          {/* Active Goals Display */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Active Focus Areas</Text>
            {(user.goals || []).filter(g => g.isActive).length > 0 ? (
              <>
                {/* Doing Section */}
                {(user.goals || []).filter(g => g.isActive && g.alreadyDoing).map(goal => (
                  <View key={goal.id} style={[styles.goalItem, styles.doingGoalItem]}>
                    <Text style={styles.goalText}>{goal.text}</Text>
                    <View style={[styles.badge, styles.doingBadge]}>
                      <Text style={styles.badgeText}>Doing</Text>
                    </View>
                  </View>
                ))}
                {/* Starting Section */}
                {(user.goals || []).filter(g => g.isActive && !g.alreadyDoing).map(goal => (
                  <View key={goal.id} style={[styles.goalItem, styles.planningGoalItem]}>
                    <Text style={styles.goalText}>{goal.text}</Text>
                    <View style={[styles.badge, styles.planningBadge]}>
                      <Text style={styles.badgeText}>Starting</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.emptyStateText}>No active focus areas.</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setEditName(user.name);
              setEditBio(user.bio);
              setIsEditing(true);
            }}
            disabled={isLoading || isImageUploading}
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderGoalsTab = () => {
    const userGoals = user.goals || [];
    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabTitle}>My Focus Areas</Text>

        {/* Filter tabs */}
        <View style={styles.focusCategoryTabs}>
          <TouchableOpacity
            style={[styles.focusCategoryTab, goalsFilter === 'all' && styles.activeFocusCategoryTab]}
            onPress={() => setGoalsFilter('all')}
          >
            <Text style={[styles.focusCategoryTabText, goalsFilter === 'all' && styles.activeFocusCategoryTabText]}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.focusCategoryTab, goalsFilter === 'doing' && styles.activeFocusCategoryTab]}
            onPress={() => setGoalsFilter('doing')}
          >
            <Text style={[styles.focusCategoryTabText, goalsFilter === 'doing' && styles.activeFocusCategoryTabText]}>Doing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.focusCategoryTab, goalsFilter === 'planning' && styles.activeFocusCategoryTab]}
            onPress={() => setGoalsFilter('planning')}
          >
            <Text style={[styles.focusCategoryTabText, goalsFilter === 'planning' && styles.activeFocusCategoryTabText]}>Starting</Text>
          </TouchableOpacity>
        </View>

        {userGoals.length > 0 ? (
          userGoals
            .filter(goal => {
              if (goalsFilter === 'all') return true;
              if (goalsFilter === 'doing') return goal.alreadyDoing;
              if (goalsFilter === 'planning') return !goal.alreadyDoing;
              return true;
            })
            .sort((a, b) => {
              if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
              if (a.alreadyDoing !== b.alreadyDoing) return a.alreadyDoing ? -1 : 1;
              return (b.createdAt || '').localeCompare(a.createdAt || '');
            })
            .map(goal => (
              <DraggableGoalCard
                key={goal.id}
                goal={goal}
                onDelete={handleDeleteGoal}
                onToggleActive={handleToggleGoalActive}
                onToggleStatus={handleToggleGoalStatus}
                onDragEnd={() => setIsDragging(false)}
                onDragStart={() => setIsDragging(true)}
              />
            ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>You haven't added any focus areas yet.</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/')}
            >
              <Text style={styles.buttonText}>Add Your First Focus Area</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.addButton]}
          onPress={() => router.push('/')}
        >
          <Text style={styles.buttonText}>Add New Focus Area</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Settings</Text>

      <View style={styles.settingItem}>
        <View style={styles.settingInfoContainer}>
          <Text style={styles.settingLabel}>Share Location</Text>
          <Text style={styles.settingDescription}>Allow others to see your location on the map</Text>
        </View>
        <Switch
          value={user.settings?.shareLocation ?? true}
          onValueChange={() => toggleSetting('shareLocation')}
          trackColor={{ false: '#CBD5E0', true: '#BEE3F8' }}
          thumbColor={user.settings?.shareLocation ? '#3B82F6' : '#A0AEC0'}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfoContainer}>
          <Text style={styles.settingLabel}>Public Profile</Text>
          <Text style={styles.settingDescription}>Allow others to view your profile and focus areas</Text>
        </View>
        <Switch
          value={user.settings?.publicProfile ?? true}
          onValueChange={() => toggleSetting('publicProfile')}
          trackColor={{ false: '#CBD5E0', true: '#BEE3F8' }}
          thumbColor={user.settings?.publicProfile ? '#3B82F6' : '#A0AEC0'}
        />
      </View>

      <View style={styles.principlesSection}>
        <Text style={styles.sectionTitle}>Focus Principles Display</Text>

        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => updatePrincipleMode('random')}
          >
            <View style={styles.radio}>
              {(user.settings?.principleMode === 'random') && <View style={styles.radioSelected} />}
            </View>
            <Text style={styles.radioLabel}>Random Daily</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => updatePrincipleMode('fixed')}
          >
            <View style={styles.radio}>
              {(user.settings?.principleMode === 'fixed') && <View style={styles.radioSelected} />}
            </View>
            <Text style={styles.radioLabel}>Fixed Weekly</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => updatePrincipleMode('custom')}
          >
            <View style={styles.radio}>
              {user.settings?.principleMode === 'custom' && <View style={styles.radioSelected} />}
            </View>
            <Text style={styles.radioLabel}>Custom Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => updatePrincipleMode('silent')}
          >
            <View style={styles.radio}>
              {user.settings?.principleMode === 'silent' && <View style={styles.radioSelected} />}
            </View>
            <Text style={styles.radioLabel}>Silent Mode</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(user.savedPrinciples && user.savedPrinciples.length > 0) && (
        <View style={styles.savedPrinciplesSection}>
          <Text style={styles.sectionTitle}>Saved Principles</Text>
          {user.savedPrinciples.map((principle, index) => (
            <View key={index} style={styles.savedPrinciple}>
              <Text style={styles.savedPrincipleText}>"{principle}"</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={isLoading || isImageUploading}
      >
        {isLoading && !isImageUploading ? <ActivityIndicator color="#E53E3E" /> : <Text style={styles.logoutButtonText}>Sign Out</Text>}
        </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0f1729', '#121a2c', '#1a2137']}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#0f1729', '#1c2741', '#121a2c']}
          style={styles.headerGradient}
        >
          <StarryBackground />

          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              disabled={isLoading || isImageUploading}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
          onPress={() => setActiveTab('profile')}
          disabled={isLoading || isImageUploading}
        >
          <Text
            style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}
          >
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'goals' && styles.activeTab]}
          onPress={() => setActiveTab('goals')}
          disabled={isLoading || isImageUploading}
        >
          <Text
            style={[styles.tabText, activeTab === 'goals' && styles.activeTabText]}
          >
            Focus
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
          disabled={isLoading || isImageUploading}
        >
          <Text
            style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isDragging}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'goals' && renderGoalsTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121a2c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1729',
  },
  loadingText: {
    marginTop: 10,
    color: '#A0AEC0',
    fontSize: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  backButton: {
    padding: 8,
    zIndex: 20,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(29, 39, 67, 0.8)',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 60,
  },
  tabTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4A5568',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
    alignSelf: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#3B82F6',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  editAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 22,
    marginTop: -1,
  },
  avatarLoadingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 50,
    zIndex: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    color: '#A0AEC0',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  bio: {
    fontSize: 16,
    color: '#CBD5E0',
    lineHeight: 24,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  doingGoalItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#38B2AC',
    paddingLeft: 12,
    backgroundColor: 'rgba(49, 151, 149, 0.1)',
  },
  planningGoalItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4299E1',
    paddingLeft: 12,
    backgroundColor: 'rgba(66, 153, 225, 0.1)',
  },
  goalText: {
    fontSize: 16,
    color: '#E2E8F0',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  doingBadge: {
    backgroundColor: 'rgba(49, 151, 149, 0.25)',
  },
  planningBadge: {
    backgroundColor: 'rgba(66, 153, 225, 0.25)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#81E6D9',
  },
  editButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0AEC0',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    fontSize: 16,
    color: '#FFFFFF',
  },
  bioInput: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginHorizontal: -4,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  goalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 5,
  },
  doingGoalCard: {
    borderLeftColor: '#38B2AC',
  },
  planningGoalCard: {
    borderLeftColor: '#4299E1',
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalCardText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 8,
    lineHeight: 24,
  },
  goalCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    marginLeft: -8,
  },
  goalAction: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  goalActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeGoalAction: {
    backgroundColor: 'rgba(49, 151, 149, 0.3)',
    borderColor: 'rgba(49, 151, 149, 0.5)',
  },
  inactiveGoalAction: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  activeGoalActionText: {
    color: '#81E6D9',
  },
  inactiveGoalActionText: {
    color: '#A0AEC0',
  },
  planningGoalAction: {
    backgroundColor: 'rgba(66, 153, 225, 0.3)',
    borderColor: 'rgba(66, 153, 225, 0.5)',
  },
  planningGoalActionText: {
    color: '#90CDF4',
    fontSize: 13,
    fontWeight: '600',
  },
  doButton: {
    backgroundColor: '#48BB78',
    paddingHorizontal: 16,
    borderColor: '#48BB78',
  },
  doButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  deleteGoalAction: {
    backgroundColor: 'rgba(229, 62, 62, 0.2)',
    borderColor: 'rgba(229, 62, 62, 0.4)',
  },
  deleteGoalActionText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    marginTop: 24,
    backgroundColor: '#48BB78',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginTop: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#A0AEC0',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  focusCategoryTabs: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  focusCategoryTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeFocusCategoryTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  focusCategoryTabText: {
    fontSize: 14,
    color: '#A0AEC0',
    fontWeight: '600',
  },
  activeFocusCategoryTabText: {
    color: '#FFFFFF',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingInfoContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#A0AEC0',
    lineHeight: 20,
  },
  principlesSection: {
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  radioGroup: {
    marginTop: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  radioLabel: {
    fontSize: 16,
    color: '#CBD5E0',
    flex: 1,
  },
  savedPrinciplesSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  savedPrinciple: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  savedPrincipleText: {
    fontSize: 16,
    color: '#CBD5E0',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  logoutButton: {
    backgroundColor: 'rgba(229, 62, 62, 0.2)',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(229, 62, 62, 0.4)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '600',
  },
  dropZoneTop: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#38B2AC',
    backgroundColor: 'rgba(56, 178, 172, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dropZoneBottom: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#4299E1',
    backgroundColor: 'rgba(66, 153, 225, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dropZoneText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0AEC0',
  },
  dragInstructionText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
    fontStyle: 'italic',
    paddingHorizontal: 16,
  },
});