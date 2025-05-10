import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ImageBackground,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PrincipleDetailsModal = ({ 
  visible, 
  principle, 
  onClose, 
  onSave, 
  isSaved = false 
}) => {
  if (!principle) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ImageBackground
            source={require('../../assets/images/space-background.jpg')}
            style={styles.backgroundImage}
            imageStyle={styles.backgroundImageStyle}
          >
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
            >
              <View style={styles.header}>
                <View style={styles.titleContainer}>
                  <Text style={styles.principleNumber}>
                    Principle {principle.id.replace(/[^\d]/g, '')}
                  </Text>
                  <Text style={styles.principleTitle}>{principle.title}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.content}>
                <Text style={styles.descriptionText}>{principle.description}</Text>
              </View>
              
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.saveButton} 
                  onPress={onSave}
                >
                  <Ionicons 
                    name={isSaved ? "bookmark" : "bookmark-outline"} 
                    size={20} 
                    color="#FFFFFF" 
                    style={styles.saveIcon}
                  />
                  <Text style={styles.saveButtonText}>
                    {isSaved ? "Saved" : "Save Principle"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </ImageBackground>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    borderRadius: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scrollViewContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  principleNumber: {
    color: '#BEE3F8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  principleTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  closeButton: {
    padding: 5,
  },
  content: {
    marginBottom: 24,
  },
  descriptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 20,
  },
  saveButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.6)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PrincipleDetailsModal;