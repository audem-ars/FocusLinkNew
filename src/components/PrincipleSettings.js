import React, { useContext, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  Modal,
  TextInput,
  ScrollView
} from 'react-native';
import { FocusPrincipleContext } from '../../src/context/FocusPrincipleContext';
import { Ionicons } from '@expo/vector-icons';

const PrincipleSettings = () => {
  const { 
    principleMode, 
    setPrincipleMode,
    principleCategory,
    changePrincipleCategory,
    getPrinciplesByCategory,
    setFixedPrinciple,
    todaysPrinciple,
    SUCCESS_PRINCIPLES,
    FOCUS_PRINCIPLES
  } = useContext(FocusPrincipleContext);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const renderModeOption = (mode, label, description) => (
    <TouchableOpacity 
      style={styles.radioOption}
      onPress={() => setPrincipleMode(mode)}
    >
      <View style={styles.radio}>
        {principleMode === mode && <View style={styles.radioSelected} />}
      </View>
      <View style={styles.radioContent}>
        <Text style={styles.radioLabel}>{label}</Text>
        <Text style={styles.radioDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryButton = (category, label) => (
    <TouchableOpacity 
      style={[
        styles.categoryButton,
        principleCategory === category && styles.activeCategoryButton
      ]}
      onPress={() => changePrincipleCategory(category)}
    >
      <Text 
        style={[
          styles.categoryButtonText,
          principleCategory === category && styles.activeCategoryButtonText
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const openPrincipleSelector = (category) => {
    setSelectedCategory(category);
    setModalVisible(true);
  };

  const PrincipleSelectorModal = () => {
    const principles = getPrinciplesByCategory(selectedCategory);
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Weekly Principle</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#4A5568" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.principleList}>
              {principles.map((principle) => (
                <TouchableOpacity 
                  key={principle.id}
                  style={styles.principleItem}
                  onPress={() => {
                    setFixedPrinciple(principle);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.principleTitle}>{principle.title}</Text>
                  {principle.description ? (
                    <Text style={styles.principleDescription} numberOfLines={2}>
                      {principle.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Focus Principles</Text>
      
      <View style={styles.radioGroup}>
        {renderModeOption(
          'random', 
          'Random Daily', 
          'See a different principle each day'
        )}
        
        {renderModeOption(
          'fixed', 
          'Fixed Weekly', 
          'Choose one principle to focus on for the week'
        )}
        
        {renderModeOption(
          'custom', 
          'Custom Mode', 
          'Show only your custom principles'
        )}
        
        {renderModeOption(
          'silent', 
          'Silent Mode', 
          'Hide principles completely'
        )}
      </View>

      {principleMode === 'fixed' && (
        <View style={styles.fixedPrincipleSection}>
          <Text style={styles.subsectionTitle}>Select Weekly Focus</Text>
          
          <View style={styles.categoryButtons}>
            {renderCategoryButton('all', 'All')}
            {renderCategoryButton('success', 'Success')}
            {renderCategoryButton('focus', 'Focus')}
            {renderCategoryButton('custom', 'Custom')}
            {renderCategoryButton('saved', 'Saved')}
          </View>
          
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={() => openPrincipleSelector(principleCategory)}
          >
            <Text style={styles.selectButtonText}>Select Weekly Principle</Text>
          </TouchableOpacity>
          
          {todaysPrinciple && principleMode === 'fixed' && (
            <View style={styles.currentPrinciple}>
              <Text style={styles.currentPrincipleLabel}>Current Weekly Principle:</Text>
              <Text style={styles.currentPrincipleText}>"{todaysPrinciple.title}"</Text>
            </View>
          )}
        </View>
      )}
      
      {principleMode !== 'silent' && principleMode !== 'fixed' && (
        <View style={styles.categorySection}>
          <Text style={styles.subsectionTitle}>Choose Principle Category</Text>
          
          <View style={styles.categoryButtons}>
            {renderCategoryButton('all', 'All')}
            {renderCategoryButton('success', 'Success')}
            {renderCategoryButton('focus', 'Focus')}
            {renderCategoryButton('custom', 'Custom')}
            {renderCategoryButton('saved', 'Saved')}
          </View>
        </View>
      )}
      
      <PrincipleSelectorModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
  },
  radioDescription: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  fixedPrincipleSection: {
    marginTop: 16,
  },
  categorySection: {
    marginTop: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A5568',
    marginBottom: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#EDF2F7',
    marginRight: 8,
    marginBottom: 8,
  },
  activeCategoryButton: {
    backgroundColor: '#EBF8FF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#4A5568',
  },
  activeCategoryButtonText: {
    color: '#3182CE',
    fontWeight: '500',
  },
  selectButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  currentPrinciple: {
    backgroundColor: '#F7FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentPrincipleLabel: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  currentPrincipleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
  },
  closeButton: {
    padding: 4,
  },
  principleList: {
    maxHeight: '90%',
  },
  principleItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  principleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
    marginBottom: 4,
  },
  principleDescription: {
    fontSize: 14,
    color: '#718096',
  },
});

export default PrincipleSettings;