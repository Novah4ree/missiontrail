import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, useRouter } from 'expo-router';

export default function LoginScreen() {

  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim,{
          toValue:1,
          duration:2500,
          useNativeDriver:true,
        }),
        Animated.timing(gradientAnim,{
          toValue:0,
          duration:2500,
          useNativeDriver:true,
        }),
      ])
    ).start();

  },[]);

  const slideX = gradientAnim.interpolate({
    inputRange:[0,1],
    outputRange:[-140,140],
  });

  return (

    <View style={styles.container}>

      <Image
        source={require('../../assets/images/splash_screen.png')}
        style={styles.logo}
      />

      <Text style={styles.subtitle}>
        CHART YOUR JOURNEY. EXPLORE YOUR WORLD.
      </Text>

      <View style={styles.card}>

        <Text style={styles.loginTitle}>
          Login
        </Text>

        <View style={styles.inputBox}>

          <Ionicons
            name="mail-outline"
            size={20}
            color="#63D8FF"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            value={email}
            onChangeText={setEmail}
          />

        </View>

        <View style={styles.inputBox}>

          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#63D8FF"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#777"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
          >

            <Ionicons
              name={
                showPassword
                ? 'eye-outline'
                : 'eye-off-outline'
              }
              size={20}
              color="#63D8FF"
            />

          </TouchableOpacity>

        </View>

        <TouchableOpacity>

          <Text style={styles.forgotText}>
            Forgot Password?
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInWrapper}
          onPress={() => router.replace('/home-backup' as Href)}
        >

          <Animated.View
            style={{
              transform:[{translateX:slideX}],
              position:'absolute',
              width:'200%',
              height:'100%',
            }}
          >

            <LinearGradient
              colors={[
                '#ff3cac',
                '#7B42F6',
                '#2b86ff'
              ]}
              start={{x:0,y:0}}
              end={{x:1,y:0}}
              style={styles.gradient}
            />

          </Animated.View>

          <Text style={styles.signInText}>
            SIGN IN
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bioButton}
        >

          <MaterialCommunityIcons
            name="fingerprint"
            size={20}
            color="#63D8FF"
          />

          <Text style={styles.bioText}>
            Biometrics Sign In
          </Text>

        </TouchableOpacity>

        <Text style={styles.orText}>
          OR CONTINUE WITH
        </Text>

        <View style={styles.socialRow}>

          <TouchableOpacity
            style={styles.socialButton}
          >

            <FontAwesome
              name="apple"
              size={24}
              color="#FFFFFF"
            />

            <Text style={styles.socialLabel}>
              Apple
            </Text>

          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
          >

            <FontAwesome
              name="google"
              size={20}
              color="#EA4335"
            />

            <Text style={styles.socialLabel}>
              Google
            </Text>

          </TouchableOpacity>

        </View>

        <TouchableOpacity>

          <Text style={styles.createText}>
            Don't have an account?{' '}
            <Text style={styles.createAccent}>
              Create Account
            </Text>
          </Text>

        </TouchableOpacity>

      </View>

    </View>

  );
}

const styles = StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:'#05050E',
    justifyContent:'center',
    alignItems:'center',
    paddingHorizontal:22,
  },

  logo:{
    width:280,
    height:280,
    resizeMode:'contain',
    marginBottom:-30,
  },

  subtitle:{
    color:'#63D8FF',
    fontSize:11,
    letterSpacing:2,
    marginBottom:14,
    textAlign:'center',
  },

  card:{
    width:'92%',
    maxWidth:420,
    backgroundColor:'#111124',
    borderRadius:30,
    paddingVertical:24,
    paddingHorizontal:22,
    borderWidth:1,
    borderColor:'#2A2A4E',
    shadowColor:'#7B42F6',
    shadowOpacity:0.35,
    shadowRadius:18,
    elevation:12,
  },

  loginTitle:{
    color:'#FFF',
    fontSize:28,
    fontWeight:'700',
    textAlign:'center',
    marginBottom:18,
  },

  inputBox:{
    flexDirection:'row',
    alignItems:'center',
    backgroundColor:'#191932',
    borderRadius:18,
    paddingHorizontal:16,
    height:56,
    marginBottom:14,
  },

  input:{
    flex:1,
    color:'#FFF',
    fontSize:15,
    marginLeft:10,
  },

  forgotText:{
    color:'#63D8FF',
    textAlign:'right',
    fontSize:13,
    marginBottom:18,
  },

  signInWrapper:{
    height:54,
    borderRadius:18,
    overflow:'hidden',
    justifyContent:'center',
    alignItems:'center',
    marginBottom:14,
  },

  gradient:{
    width:'100%',
    height:'100%',
  },

  signInText:{
    color:'#FFF',
    fontSize:17,
    fontWeight:'bold',
    letterSpacing:1,
  },

  bioButton:{
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'#17172D',
    borderRadius:18,
    paddingVertical:14,
    marginBottom:18,
  },

  bioText:{
    color:'#63D8FF',
    marginLeft:10,
    fontWeight:'600',
  },

  orText:{
    color:'#767676',
    textAlign:'center',
    fontSize:11,
    marginBottom:16,
    letterSpacing:1.5,
  },

  socialRow:{
    flexDirection:'row',
    justifyContent:'space-between',
    gap:14,
    marginBottom:22,
  },

  socialButton:{
    flex:1,
    backgroundColor:'#191932',
    borderRadius:18,
    height:58,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },

  socialLabel:{
    color:'#FFFFFF',
    marginLeft:10,
    fontWeight:'600',
    fontSize:15,
  },

  createText:{
    color:'#AAAAAA',
    textAlign:'center',
    fontSize:13,
  },

  createAccent:{
    color:'#FF4FD8',
    fontWeight:'bold',
  },

});
