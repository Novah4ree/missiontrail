// ======================================================
// HOME.TSX
// ======================================================
// Mission Trail Home Screen
// Temporary placeholder page
// ======================================================

import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ======================================================
// SCREEN
// ======================================================

export default function Home() {

  return (

    <View style={styles.container}>

      {/* ======================================================
          MAIN MESSAGE
      ====================================================== */}

      <Text style={styles.title}>
        This Page Is Getting Worked On
      </Text>

    </View>

  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

  // ======================================================
  // MAIN CONTAINER
  // ======================================================

  container:{
    flex:1,

    backgroundColor:'#000000',

    justifyContent:'center',

    alignItems:'center',

    paddingHorizontal:20,
  },

  // ======================================================
  // TEXT
  // ======================================================

  title:{
    color:'#FFFFFF',

    fontSize:32,

    fontWeight:'bold',

    textAlign:'center',
  },

});