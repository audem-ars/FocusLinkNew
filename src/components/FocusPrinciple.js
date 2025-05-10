import React, { useContext, useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FocusPrincipleContext } from '../context/FocusPrincipleContext';

const { width, height } = Dimensions.get('window');

const FocusPrinciple = ({ style }) => {
  // All useState/useRef hooks must be declared unconditionally at the top
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const twinkleStars = useRef(
    Array.from({ length: 30 }, () => new Animated.Value(Math.random()))
  ).current;
  
  // Shooting star animation
  const shootingStarAnim = useRef(new Animated.Value(0)).current;
  const shootingStarOpacity = useRef(new Animated.Value(0)).current;
  const shootingStarAngle = useRef(Math.random() * 60 - 30); // -30 to +30 degrees
  const shootingStarTop = useRef(Math.random() * (height * 0.4));
  
  // Mini-nebula animations
  const miniNebulae = useRef(
    Array.from({ length: 5 }, () => ({
      xPos: new Animated.Value(Math.random() * width),
      yPos: new Animated.Value(Math.random() * height * 0.6),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.5 + Math.random() * 0.5),
      color: ['#c29eff', '#a2ffc7', '#ffacb9', '#ffe8ac', '#acddff'][
        Math.floor(Math.random() * 5)
      ],
      particleCount: 6 + Math.floor(Math.random() * 6) // 6-12 particles
    }))
  ).current;
  
  // Color accent animations
  const purpleClusterOpacity = useRef(new Animated.Value(0.01)).current;
  const greenClusterOpacity = useRef(new Animated.Value(0.01)).current;
  const redClusterOpacity = useRef(new Animated.Value(0.01)).current;

  // Use context with error handling
  let contextValues = {
    todaysPrinciple: null,
    refreshPrinciple: null,
    savePrinciple: null,
    unsavePrinciple: null,
    savedPrinciples: [],
    principleMode: 'random'
  };

  try {
    const context = useContext(FocusPrincipleContext);
    if (context) {
      contextValues = context;
    }
  } catch (error) {
    console.error("Error accessing FocusPrinciple context:", error);
  }

  const {
    todaysPrinciple,
    refreshPrinciple,
    savePrinciple,
    unsavePrinciple,
    savedPrinciples,
    principleMode
  } = contextValues;

  // animations and other effects
  useEffect(() => {
    // Only run animations if we have a principle to display
    if (!todaysPrinciple) return;

    // Fade in principle
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true
      })
    ]).start();

    // Set up twinkling stars animation
    const twinkleStarsAnimation = () => {
      const animations = twinkleStars.map((star) => {
        return Animated.sequence([
          Animated.timing(star, {
            toValue: Math.random() * 0.5 + 0.5,
            duration: Math.random() * 1000 + 1000,
            useNativeDriver: true
          }),
          Animated.timing(star, {
            toValue: Math.random() * 0.3 + 0.2,
            duration: Math.random() * 1000 + 1000,
            useNativeDriver: true
          })
        ]);
      });

      Animated.parallel(animations).start(() => twinkleStarsAnimation());
    };

    twinkleStarsAnimation();

    // Set up shooting star animation
    const animateShootingStar = () => {
      // Reset for next shooting star
      shootingStarAngle.current = (Math.random() * 60 - 30); // -30 to +30 degrees
      shootingStarTop.current = Math.random() * (height * 0.4);
      
      Animated.sequence([
        // Reset to starting position
        Animated.timing(shootingStarAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true
        }),
        // Reset opacity
        Animated.timing(shootingStarOpacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true
        }),
        // Fade in
        Animated.timing(shootingStarOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        }),
        // Move across the screen
        Animated.parallel([
          Animated.timing(shootingStarAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true
          }),
          // Fade out at the end
          Animated.timing(shootingStarOpacity, {
            toValue: 0,
            duration: 1400, // Slightly shorter than the movement to fade out before end
            useNativeDriver: true
          })
        ])
      ]).start();

      // Schedule the next shooting star (less frequent: 8-20 seconds)
      setTimeout(animateShootingStar, Math.random() * 12000 + 8000);
    };

    // Start shooting star animations after a random delay
    setTimeout(animateShootingStar, Math.random() * 3000 + 3000);
    
    // Animate star clusters
    const animatePurpleCluster = () => {
      Animated.sequence([
        Animated.timing(purpleClusterOpacity, {
          toValue: 0.8,
          duration: 4000,
          useNativeDriver: true
        }),
        Animated.timing(purpleClusterOpacity, {
          toValue: 0.3,
          duration: 3000,
          useNativeDriver: true
        })
      ]).start(() => {
        setTimeout(animatePurpleCluster, 2000);
      });
    };
    
    const animateGreenCluster = () => {
      Animated.sequence([
        Animated.timing(greenClusterOpacity, {
          toValue: 0.8,
          duration: 3500,
          useNativeDriver: true
        }),
        Animated.timing(greenClusterOpacity, {
          toValue: 0.3,
          duration: 4500,
          useNativeDriver: true
        })
      ]).start(() => {
        setTimeout(animateGreenCluster, 3000);
      });
    };
    
    const animateRedCluster = () => {
      Animated.sequence([
        Animated.timing(redClusterOpacity, {
          toValue: 0.8,
          duration: 5000,
          useNativeDriver: true
        }),
        Animated.timing(redClusterOpacity, {
          toValue: 0.3,
          duration: 4000,
          useNativeDriver: true
        })
      ]).start(() => {
        setTimeout(animateRedCluster, 4000);
      });
    };
    
    // Start color glow animations with delays
    setTimeout(animatePurpleCluster, 1000);
    setTimeout(animateGreenCluster, 3000);
    setTimeout(animateRedCluster, 5000);
    
    // Animate mini nebulae
    miniNebulae.forEach((nebula, index) => {
      const animateNebula = () => {
        // Reset to a new position
        nebula.xPos.setValue(Math.random() * width * 0.8);
        nebula.yPos.setValue(Math.random() * height * 0.5);
        
        // Create animation sequence
        Animated.sequence([
          // Fade in
          Animated.timing(nebula.opacity, {
            toValue: 0.8,
            duration: 2000,
            useNativeDriver: true
          }),
          // Hold
          Animated.delay(3000),
          // Fade out
          Animated.timing(nebula.opacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true
          }),
          // Wait
          Animated.delay(Math.random() * 3000)
        ]).start(() => {
          animateNebula();
        });
        
        // Slowly drift
        Animated.timing(nebula.xPos, {
          toValue: nebula.xPos._value + (Math.random() * 40 - 20),
          duration: 8000,
          useNativeDriver: true
        }).start();
        
        Animated.timing(nebula.yPos, {
          toValue: nebula.yPos._value + (Math.random() * 40 - 20),
          duration: 8000,
          useNativeDriver: true
        }).start();
      };
      
      // Start each nebula with a different delay
      setTimeout(animateNebula, index * 2000);
    });
    
  }, [todaysPrinciple]);

  // Early return AFTER all hooks are declared
  if (principleMode === 'silent' || !todaysPrinciple) {
    return null;
  }

  const isSaved = savedPrinciples?.includes(todaysPrinciple.id) || false;

  const handleSave = () => {
    if (!savePrinciple || !unsavePrinciple) return;

    if (isSaved) {
      unsavePrinciple(todaysPrinciple.id);
    } else {
      savePrinciple(todaysPrinciple.id);
    }
  };

  const handleRefresh = () => {
    if (!refreshPrinciple) return;

    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      // Change principle
      refreshPrinciple();
      
      // Fade in with new content
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        })
      ]).start();
    });
  };

  // Generate stars for the background
  const renderStars = () => {
    return twinkleStars.map((anim, index) => {
      const size = 2 + Math.random() * 2;
      const top = Math.random() * 100;
      const left = Math.random() * 100;
      
      // Randomly add color to some stars
      const isColoredStar = Math.random() > 0.7; // 30% colored stars
      let starColor = '#ffffff';
      
      if (isColoredStar) {
        const colorRoll = Math.random();
        if (colorRoll < 0.33) {
          starColor = '#ffefcf'; // Slightly yellow star
        } else if (colorRoll < 0.66) {
          starColor = '#d4f8ff'; // Slightly blue star
        } else {
          starColor = '#ffe8e8'; // Slightly red star
        }
      }
      
      return (
        <Animated.View
          key={index}
          style={[
            styles.star,
            {
              width: size,
              height: size,
              top: `${top}%`,
              left: `${left}%`,
              backgroundColor: starColor,
              opacity: anim,
              transform: [
                { scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1.3]
                })}
              ]
            }
          ]}
        />
      );
    });
  };

  // Generate a star cluster with the given color
  const generateStarCluster = (color, count, baseTop, baseLeft, spread, animated = true) => {
    // Define a set of stars in a clustered formation
    const stars = [];
    
    for (let i = 0; i < count; i++) {
      // Create a random position within the cluster area
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spread;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      
      // Star properties
      const top = baseTop + offsetY;
      const left = baseLeft + offsetX;
      const size = 1 + Math.random() * 2.5;
      const opacity = 0.3 + Math.random() * 0.7;
      
      stars.push(
        <View
          key={`${color}-star-${i}`}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            top: top,
            left: left,
            backgroundColor: color,
            borderRadius: size,
            opacity: opacity,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 2,
          }}
        />
      );
    }
    
    return stars;
  };
  
  // Render mini-nebulae
  const renderMiniNebulae = () => {
    return miniNebulae.map((nebula, nebulaIndex) => (
      <Animated.View 
        key={`nebula-${nebulaIndex}`}
        style={{
          position: 'absolute',
          opacity: nebula.opacity,
          transform: [
            { translateX: nebula.xPos },
            { translateY: nebula.yPos },
            { scale: nebula.scale }
          ],
          zIndex: 3
        }}
      >
        {/* Render each particle in the mini nebula */}
        {Array.from({ length: nebula.particleCount }).map((_, particleIndex) => {
          // Calculate position of particle within nebula
          const angle = (particleIndex / nebula.particleCount) * Math.PI * 2;
          const radius = 5 + Math.random() * 8;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const size = 1.5 + Math.random() * 2;
          
          return (
            <View
              key={`nebula-${nebulaIndex}-particle-${particleIndex}`}
              style={{
                position: 'absolute',
                width: size,
                height: size,
                left: x,
                top: y,
                backgroundColor: nebula.color,
                borderRadius: size,
                opacity: 0.6 + Math.random() * 0.4
              }}
            />
          );
        })}
      </Animated.View>
    ));
  };

  // Calculate shooting star positions based on interpolation and angle
  // This ensures the star moves in the direction it's pointing
  const startX = -50;
  const endX = width + 50;
  const angleSin = Math.sin(shootingStarAngle.current * Math.PI / 180);
  const angleCos = Math.cos(shootingStarAngle.current * Math.PI / 180);
  
  // Calculate the total distance the star will travel
  const totalDistance = endX - startX;
  
  // Calculate the vertical change based on the angle
  const deltaY = totalDistance * Math.tan(shootingStarAngle.current * Math.PI / 180);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.outerContainer, style]}>
        <LinearGradient
          colors={['#0f1729', '#1c2741', '#121a2c']}
          style={styles.gradientBackground}
        >
          {/* Regular white stars in the background */}
          {renderStars()}
          
          {/* Purple star cluster */}
          <Animated.View style={{ opacity: purpleClusterOpacity }}>
            {generateStarCluster('#c29eff', 60, 50, 70, 120)}
          </Animated.View>
          
          {/* Green star cluster */}
          <Animated.View style={{ opacity: greenClusterOpacity }}>
            {generateStarCluster('#a2ffc7', 45, 180, 260, 90)}
          </Animated.View>
          
          {/* Red star cluster */}
          <Animated.View style={{ opacity: redClusterOpacity }}>
            {generateStarCluster('#ffacb9', 50, 130, 100, 100)}
          </Animated.View>
          
          {/* Animated mini nebulae */}
          {renderMiniNebulae()}
          
          {/* Enhanced Shooting star - uses interpolation for proper angled motion */}
          <Animated.View 
            style={[
              styles.shootingStar,
              {
                opacity: shootingStarOpacity,
                top: shootingStarTop.current,
                transform: [
                  { translateX: shootingStarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [startX, endX]
                  })},
                  { translateY: shootingStarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, deltaY]
                  })},
                  { rotate: `${shootingStarAngle.current}deg` }
                ]
              }
            ]}
          >
            {/* Bright head, dim tail */}
            <View style={styles.shootingStarHead} />
            
            {/* Shorter, dimmer tail */}
            <View style={[styles.shootingStarTail, { width: 8, opacity: 0.6 }]} />
            <View style={[styles.shootingStarTail, { width: 12, opacity: 0.3 }]} />
            <View style={[styles.shootingStarTail, { width: 20, opacity: 0.15 }]} />
          </Animated.View>
          
          <Animated.View 
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={styles.content}>
              <Text style={styles.principleText}>"{todaysPrinciple.title}"</Text>
              
              {todaysPrinciple.description ? (
                <Text style={styles.descriptionText}>{todaysPrinciple.description}</Text>
              ) : null}
            </View>
            
            <View style={styles.actions}>
              {principleMode !== 'fixed' && refreshPrinciple && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleRefresh}
                  accessibilityLabel="Get new principle"
                >
                  <Ionicons name="refresh-outline" size={22} color="#d0d7fa" />
                </TouchableOpacity>
              )}
              
              {(savePrinciple && unsavePrinciple) && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleSave}
                  accessibilityLabel={isSaved ? "Remove from saved" : "Save principle"}
                >
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={22}
                    color={isSaved ? "#6e9fff" : "#d0d7fa"}
                  />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </LinearGradient>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradientBackground: {
    padding: 20,
    minHeight: 160,
    position: 'relative',
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  shootingStar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    height: 3,
    zIndex: 5,
  },
  shootingStarHead: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  shootingStarTail: {
    height: 2,
    backgroundColor: '#ffffff',
    marginLeft: -1, // Overlap slightly for continuity
  },
  container: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  content: {
    marginBottom: 12,
  },
  principleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 10,
    textShadowColor: 'rgba(158, 174, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#d0d7fa',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  iconButton: {
    padding: 10,
    marginHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});

export default FocusPrinciple;