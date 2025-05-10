import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  TextInput,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { FocusPrincipleContext } from '../src/context/FocusPrincipleContext';
import PrincipleDetailsModal from '../components/PrincipleDetailsModal';

const SuccessPrinciplesLibrary = () => {
  const { 
    SUCCESS_PRINCIPLES, 
    savePrinciple, 
    unsavePrinciple, 
    savedPrinciples,
    setFixedPrinciple
  } = useContext(FocusPrincipleContext);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrinciple, setSelectedPrinciple] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Filter principles based on search query
  const filteredPrinciples = SUCCESS_PRINCIPLES.filter(principle => 
    principle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    principle.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handlePrinciplePress = (principle) => {
    setSelectedPrinciple(principle);
    setModalVisible(true);
  };
  
  const handleSavePrinciple = () => {
    if (!selectedPrinciple) return;
    
    const isSaved = savedPrinciples.includes(selectedPrinciple.id);
    
    if (isSaved) {
      unsavePrinciple(selectedPrinciple.id);
    } else {
      savePrinciple(selectedPrinciple.id);
    }
  };
  
  const handleSetAsFixed = (principle) => {
    setFixedPrinciple(principle);
  };
  
  const renderPrincipleItem = ({ item }) => {
    const isSaved = savedPrinciples.includes(item.id);
    
    return (
      <TouchableOpacity 
        style={styles.principleCard}
        onPress={() => handlePrinciplePress(item)}
      >
        <View style={styles.principleHeader}>
          <Text style={styles.principleNumber}>Principle {item.id.replace(/[^\d]/g, '')}</Text>
          {isSaved && (
            <Ionicons name="bookmark" size={16} color="#3B82F6" />
          )}
        </View>
        <Text style={styles.principleTitle}>{item.title}</Text>
        <Text 
          style={styles.principleDescription} 
          numberOfLines={2}
        >
          {item.description}
        </Text>
        
        <View style={styles.principleActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => handlePrinciplePress(item)}
          >
            <Text style={styles.actionButtonText}>View Details</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.fixedButton]}
            onPress={() => handleSetAsFixed(item)}
          >
            <Text style={styles.actionButtonText}>Set as Weekly Focus</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Success Principles</Text>
        <Text style={styles.headerSubtitle}>
          The 55 Fundamental Principles for Achieving Success
        </Text>
      </View>
      
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#718096" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search principles..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      <FlatList
        data={filteredPrinciples}
        renderItem={renderPrincipleItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.principlesList}
        showsVerticalScrollIndicator={false}
      />
      
      <PrincipleDetailsModal
        visible={modalVisible}
        principle={selectedPrinciple}
        onClose={() => setModalVisible(false)}
        onSave={handleSavePrinciple}
        isSaved={selectedPrinciple ? savedPrinciples.includes(selectedPrinciple.id) : false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#4A5568',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2D3748',
  },
  principlesList: {
    padding: 16,
    paddingBottom: 120, // Extra padding at bottom
  },
  principleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  principleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  principleNumber: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  principleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  principleDescription: {
    fontSize: 16,
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 16,
  },
  principleActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  viewButton: {
    backgroundColor: '#EBF8FF',
  },
  fixedButton: {
    backgroundColor: '#E9D8FD',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2B6CB0',
  },
});

export default SuccessPrinciplesLibrary;