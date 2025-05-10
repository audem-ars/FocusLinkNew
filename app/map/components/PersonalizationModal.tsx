import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';

// Emoji categories with options (Keep this the same)
const EMOJI_OPTIONS = {
  profile: ['profile_photo'],
  markers: ['📍', '📌', '📣', '🚩', '⚑', '🏁', '🔴', '🔵', '🟢', '🟡'],
  people: ['👨', '👩', '👶', '👧', '👦', '👴', '👵', '🧔'],
  activities: ['🏃', '🚶', '🧘', '🏋️', '🚴', '🏊', '⚽', '🏈', '🎯'],
  nature: ['🌳', '🌲', '🌴', '🌵', '🌷', '🌹', '🌻', '🌺'],
  animals: ['🐕', '🐈', '🐎', '🦁', '🐘', '🦒', '🦚', '🦜'],
  objects: ['📱', '💻', '📚', '🎮', '🎨', '🎭', '🔭', '⚙️'],
  symbols: ['❤️', '⭐', '🔥', '✨', '💫', '💯', '💪', '🙏'],
  transportation: ['🚗', '🚕', '🚲', '🛵', '✈️', '🚢', '🚆', '🚁'],
};

interface PersonalizationModalProps {
  visible: boolean;
  onClose: () => void;
  selectedEmoji: string;
  onSelectEmoji: (emoji: string) => void;
}

const PersonalizationModal = ({
  visible,
  onClose,
  selectedEmoji,
  onSelectEmoji
}: PersonalizationModalProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('markers');
  const { userProfile } = useAuth(); // Simplified useAuth import

  // Function to render the emoji option based on category (Keep this the same)
  const renderEmojiOption = (emoji: string, category: string) => {
    if (category === 'profile' && emoji === 'profile_photo') {
      return (
        <TouchableOpacity
          key="profile_photo"
          style={[
            styles.emojiButton,
            styles.profilePhotoButton,
            selectedEmoji === 'profile_photo' && styles.selectedEmojiButton
          ]}
          onPress={() => onSelectEmoji('profile_photo')}
        >
          {userProfile?.photoURL ? (
            <Image
              source={{ uri: userProfile.photoURL }}
              style={styles.profilePhoto}
            />
          ) : (
            <View style={styles.defaultProfileIcon}>
              <Text style={styles.profileInitial}>
                {userProfile?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {/* Profile label might be too small - adjust or remove if needed */}
          <Text style={styles.profileLabel}>Profile</Text>
        </TouchableOpacity>
      );
    } else {
      return (
        <TouchableOpacity
          key={emoji}
          style={[
            styles.emojiButton,
            selectedEmoji === emoji && styles.selectedEmojiButton
          ]}
          onPress={() => onSelectEmoji(emoji)}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Use TouchableOpacity for dimiss on overlay tap */}
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPressOut={onClose} // Close when tapping outside the content
      >
        {/* Prevent taps inside the content from closing the modal */}
        <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Map Icon</Text>
            {/* Removed the top Save button, keep only the bottom one */}
             <TouchableOpacity onPress={onClose} style={styles.modalCloseButtonContainer}>
               <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalDescription}>
            Select an emoji to represent you on the map
          </Text>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs} // Keep horizontal scroll for tabs
          >
            {Object.keys(EMOJI_OPTIONS).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryTab,
                  activeCategory === category && styles.activeCategoryTab
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === category && styles.activeCategoryTabText
                  ]}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ---- CORE CHANGE: Wrap Emoji Grid in a Vertical ScrollView ---- */}
          <ScrollView style={styles.emojiGridContainer}>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS[activeCategory as keyof typeof EMOJI_OPTIONS].map((emoji) => (
                renderEmojiOption(emoji, activeCategory)
              ))}
            </View>
          </ScrollView>
          {/* ---- END CORE CHANGE ---- */}

          {/* Button Row at the bottom */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            {/* Save button remains - closes the modal */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={onClose} // Selection happens on tap, this just closes
            >
              <Text style={styles.saveButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0, // Remove any padding
  },
  
  modalContent: {
    backgroundColor: 'white',
    width: '90%', 
    height: 600, // Increase height further
    maxHeight: '90%', // Increase max height
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    // Add these lines:
    flex: 0, // Prevent flex from squishing the content
    flexShrink: 0, // Prevent shrinking
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18, // Slightly smaller title
    fontWeight: 'bold',
    color: '#1A202C',
  },
  modalCloseButtonContainer: {
     padding: 5, // Easier tap target
  },
  modalCloseButton: {
    fontSize: 22,
    color: '#718096',
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 14, // Slightly smaller description
    color: '#4A5568',
    marginBottom: 16,
    textAlign: 'center', // Center description
  },
  categoryTabs: {
    // Styles for horizontal tab scroll view
    flexGrow: 0, // Prevent tabs from taking too much space
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 5,
  },
  activeCategoryTab: {
    borderBottomWidth: 3, // Make active indicator bolder
    borderBottomColor: '#4299E1',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  activeCategoryTabText: {
    color: '#2B6CB0',
    fontWeight: '600',
  },
  // Style for the NEW vertical ScrollView containing the grid
  emojiGridContainer: {
    flex: 1,
    minHeight: 300, // Add minimum height to ensure emojis are visible
  },
  // Styles for the View *inside* the vertical ScrollView
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', // Align items to the start
    paddingHorizontal: 5, // Add some horizontal padding
  },
  emojiButton: {
    width: '18%', // Make buttons slightly smaller
    aspectRatio: 1,
    margin: '1%', // Reduce margin to fit more in view
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  
  selectedEmojiButton: {
    borderColor: '#4299E1',
    backgroundColor: '#EBF8FF',
    borderWidth: 2,
  },
  emoji: {
    fontSize: 28, // Adjust emoji size as needed
  },
  profilePhotoButton: {
    // Specific styles if needed, can often inherit from emojiButton
     width: '20%', // Keep consistent grid size
     margin: '2.5%',
  },
  profilePhoto: {
    width: '75%', // Adjust size within the button
    height: '75%',
    borderRadius: 50, // Make it circular
    // No marginBottom needed if centered
  },
  defaultProfileIcon: {
    width: '75%',
    height: '75%',
    borderRadius: 50,
    backgroundColor: '#CBD5E0', // Lighter default background
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#4A5568', // Darker initial color
    fontSize: 20, // Adjust size
    fontWeight: 'bold',
  },
  profileLabel: {
    position: 'absolute', // Position label at the bottom
    bottom: 3,
    fontSize: 9, // Smaller label
    color: '#718096',
    textAlign: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.7)', // Optional background for readability
    paddingVertical: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10, // Space above buttons
    paddingTop: 15, // Space below the grid/scroll area
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexGrow: 0, // Prevent button row from expanding
  },
  cancelButton: {
    flex: 1, // Take half the space
    backgroundColor: '#EDF2F7',
    paddingVertical: 12, // Slightly smaller buttons
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
  },
  saveButton: {
    flex: 1, // Take half the space
    backgroundColor: '#4299E1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 6,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default PersonalizationModal;