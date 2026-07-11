import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
 Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

let Voice: any = null;
if (Platform.OS !== 'web') {
  Voice = require('@react-native-voice/voice').default;
}

// OpenAI Configuration
const CHAT_API_URL = "https://api.openai.com/v1/chat/completions";

// TEMPORARY: Replace with your own API key for local testing.
// Remove this before committing or sharing your code.
const OPENAI_API_KEY = "";

export default function MissionTrailBot({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'bot',
      text: "Hey! I'm your Mission Trail concierge. How can I help you get active today?"
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isVoiceModeRef = useRef(false);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);

  const startListening = () => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.onresult = (event: any) => {
          if (isSpeakingRef.current) return;
          handleSendMessage(event.results[0][0].transcript);
        };
        recognitionRef.current.onend = () => {
          isListeningRef.current = false;
          if (isVoiceModeRef.current && !isSpeakingRef.current) setTimeout(() => startListening(), 750);
        };
      }
      if (!isListeningRef.current) { isListeningRef.current = true; recognitionRef.current.start(); }
    } else if (Voice) { Voice.start('en-US'); }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (Platform.OS === 'web') recognitionRef.current?.stop();
    else if (Voice) Voice.stop();
  };

  const toggleVoiceMode = () => {
    const newState = !isVoiceMode;
    isVoiceModeRef.current = newState;
    setIsVoiceMode(newState);
    if (newState) startListening(); else stopListening();
  };

  async function handleSendMessage(text: string) {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);
    setInputText('');

    try {
      stopListening();
      isSpeakingRef.current = true;

      // Debugging: Verify API key is loaded
      console.log("API Key:", process.env.EXPO_PUBLIC_OPENAI_API_KEY?.substring(0, 10));

      // Debugging: Verify API key is loaded
console.log("API Key:", OPENAI_API_KEY.substring(0, 10));

const response = await fetch(CHAT_API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
  },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a Mission Trail concierge. Keep answers short, friendly, and focused on missions. End every response with an action-oriented question.",
            },
            { role: "user", content: text },
          ],
        }),
      });

      // Parse JSON once
      const data = await response.json();
      
      // Check for errors after parsing
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to connect to OpenAI");
      }

      const botReply = data.choices?.[0]?.message?.content;
      if (!botReply) {
        throw new Error("No response received from AI");
      }

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "bot", text: botReply }]);
      Speech.speak(botReply);
      isSpeakingRef.current = false;
      if (isVoiceModeRef.current) setTimeout(() => startListening(), 750);
      
    } catch (err) {
      console.error("MissionTrailBot Error:", err);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "bot", text: "Sorry, I'm having trouble connecting to the service." }]);
      isSpeakingRef.current = false;
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot}>
        <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.chatCard}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Mission Trail Concierge</Text>
              <Pressable onPress={toggleVoiceMode} style={[styles.headerButton, { backgroundColor: isVoiceMode ? '#FF2D75' : '#1e0d3e' }]}>
                <Ionicons name={isVoiceMode ? "mic" : "mic-outline"} size={20} color="#FFF" />
              </Pressable>
              <Pressable onPress={onClose} style={styles.headerButton}><Ionicons name="close" size={20} color="#FFF" /></Pressable>
            </View>
            <FlatList data={messages} keyExtractor={(item) => item.id} renderItem={({ item }) => (
                <View style={[styles.messageRow, item.sender === 'user' ? styles.userMessageRow : styles.botMessageRow]}>
                   <View style={[styles.messageBubble, item.sender === 'user' ? styles.userMessageBubble : styles.botMessageBubble]}>
                     <Text style={styles.messageText}>{item.text}</Text>
                   </View>
                </View>
            )} />
            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <TextInput value={inputText} onChangeText={setInputText} placeholder="Type mission..." placeholderTextColor="#7D82A8" style={styles.textInput} />
                <Pressable onPress={() => handleSendMessage(inputText)} style={styles.sendButton}><Ionicons name="send" size={18} color="#FFFFFF" /></Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  keyboardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 12, 0.76)' },
  chatCard: { width: '92%', maxWidth: 540, height: '74%', borderRadius: 22, backgroundColor: '#07051c', overflow: 'hidden' },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#333' },
  headerTitle: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  headerButton: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  messageRow: { width: '100%', marginBottom: 13, flexDirection: 'row', paddingHorizontal: 14 },
  botMessageRow: { justifyContent: 'flex-start' },
  userMessageRow: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17 },
  botMessageBubble: { backgroundColor: '#1c1041' },
  userMessageBubble: { backgroundColor: '#0f699b' },
  messageText: { fontSize: 14.5, color: '#FFF' },
  inputSection: { padding: 12, borderTopWidth: 1, borderTopColor: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 18, backgroundColor: '#04071b' },
  textInput: { flex: 1, color: '#FFF', padding: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B2BE2' }
});