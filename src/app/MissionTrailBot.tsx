import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

// Purpose: Renders the Mission Trail bot interface.
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
      text: "Hey! I'm your Mission Trail concierge. How can I help you get active today?",
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isVoiceModeRef = useRef(false);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    isListeningRef.current = true;
  });

  useSpeechRecognitionEvent('end', () => {
    isListeningRef.current = false;
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();

    if (!transcript || isSpeakingRef.current) {
      return;
    }

    isListeningRef.current = false;
    void handleSendMessage(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    isListeningRef.current = false;

    console.warn(
      'Speech recognition error:',
      event.error,
      event.message,
    );

    // Permission problems require user action, so do not keep retrying.
    if (
      event.error === 'not-allowed' ||
      event.error === 'service-not-allowed'
    ) {
      isVoiceModeRef.current = false;
      setIsVoiceMode(false);
      return;
    }

    // For temporary issues such as no speech, allow voice mode to listen again.
    if (isVoiceModeRef.current && !isSpeakingRef.current) {
      setTimeout(() => {
        if (isVoiceModeRef.current && !isSpeakingRef.current) {
          void startListening();
        }
      }, 750);
    }
  });

  // Purpose: Starts listening for a voice command.
  async function startListening() {
    if (
      isListeningRef.current ||
      isSpeakingRef.current ||
      !isVoiceModeRef.current
    ) {
      return;
    }

    if (Platform.OS === 'web') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        Alert.alert(
          'Voice unavailable',
          'Speech recognition is not supported by this browser.',
        );

        isVoiceModeRef.current = false;
        setIsVoiceMode(false);
        return;
      }

      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.interimResults = false;
        recognitionRef.current.continuous = false;

        recognitionRef.current.onresult = (event: any) => {
          isListeningRef.current = false;

          const transcript =
            event.results?.[0]?.[0]?.transcript?.trim();

          if (
            transcript &&
            !isSpeakingRef.current &&
            isVoiceModeRef.current
          ) {
            void handleSendMessage(transcript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          isListeningRef.current = false;

          console.warn(
            'Browser speech recognition error:',
            event?.error ?? event,
          );
        };

        recognitionRef.current.onend = () => {
          isListeningRef.current = false;
        };
      }

      try {
        isListeningRef.current = true;
        recognitionRef.current.start();
      } catch (error) {
        isListeningRef.current = false;
        console.warn(
          'Unable to start browser speech recognition:',
          error,
        );
      }

      return;
    }

    try {
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Microphone permission required',
          'Mission Trails needs microphone and speech recognition permission to use voice commands.',
        );

        isVoiceModeRef.current = false;
        setIsVoiceMode(false);
        return;
      }

      isListeningRef.current = true;

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch (error) {
      isListeningRef.current = false;

      console.warn(
        'Unable to start speech recognition:',
        error,
      );

      Alert.alert(
        'Voice unavailable',
        'Mission Trails could not start speech recognition.',
      );

      isVoiceModeRef.current = false;
      setIsVoiceMode(false);
    }
  }

  // Purpose: Stops listening.
  function stopListening() {
    const wasListening = isListeningRef.current;
    isListeningRef.current = false;

    if (!wasListening) {
      return;
    }

    try {
      if (Platform.OS === 'web') {
        recognitionRef.current?.stop();
      } else {
        ExpoSpeechRecognitionModule.stop();
      }
    } catch (error) {
      console.warn(
        'Unable to stop speech recognition:',
        error,
      );
    }
  }

  // Purpose: Restarts voice recognition after the bot finishes talking.
  function restartListeningAfterSpeech() {
    isSpeakingRef.current = false;

    if (!isVoiceModeRef.current) {
      return;
    }

    setTimeout(() => {
      if (
        isVoiceModeRef.current &&
        !isSpeakingRef.current &&
        !isListeningRef.current
      ) {
        void startListening();
      }
    }, 750);
  }

  // Purpose: Toggles voice mode.
  function toggleVoiceMode() {
    const newState = !isVoiceMode;

    isVoiceModeRef.current = newState;
    setIsVoiceMode(newState);

    if (newState) {
      void startListening();
    } else {
      stopListening();
      Speech.stop();
      isSpeakingRef.current = false;
    }
  }

  // Purpose: Handles sending a user message.
  async function handleSendMessage(text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'user',
        text: cleanText,
      },
    ]);

    setInputText('');
    stopListening();

    try {
      isSpeakingRef.current = true;

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        'mission-ai',
        {
          body: {
            message: cleanText,
          },
        },
      );

      if (error) {
        throw new Error(
          error.message ||
            'Failed to connect to Mission AI',
        );
      }

      const botReply =
        typeof data?.text === 'string'
          ? data.text.trim()
          : '';

      if (!botReply) {
        throw new Error(
          'No response received from AI',
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: botReply,
        },
      ]);

      Speech.speak(botReply, {
        language: 'en-US',
        onDone: restartListeningAfterSpeech,
        onStopped: restartListeningAfterSpeech,
        onError: () => {
          restartListeningAfterSpeech();
        },
      });
    } catch (error) {
      console.error(
        'MissionTrailBot Error:',
        error,
      );

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: "Sorry, I'm having trouble connecting to the service.",
        },
      ]);

      isSpeakingRef.current = false;

      if (isVoiceModeRef.current) {
        setTimeout(() => {
          void startListening();
        }, 750);
      }
    }
  }

  function handleClose() {
    isVoiceModeRef.current = false;
    setIsVoiceMode(false);

    stopListening();
    Speech.stop();

    isSpeakingRef.current = false;

    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalRoot}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <Pressable
            style={styles.backdrop}
            onPress={handleClose}
          />

          <View style={styles.chatCard}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                Mission Trail Concierge
              </Text>

              <Pressable
                onPress={toggleVoiceMode}
                style={[
                  styles.headerButton,
                  {
                    backgroundColor: isVoiceMode
                      ? '#FF2D75'
                      : '#1e0d3e',
                  },
                ]}
              >
                <Ionicons
                  name={
                    isVoiceMode
                      ? 'mic'
                      : 'mic-outline'
                  }
                  size={20}
                  color="#FFF"
                />
              </Pressable>

              <Pressable
                onPress={handleClose}
                style={styles.headerButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="#FFF"
                />
              </Pressable>
            </View>

            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageRow,
                    item.sender === 'user'
                      ? styles.userMessageRow
                      : styles.botMessageRow,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      item.sender === 'user'
                        ? styles.userMessageBubble
                        : styles.botMessageBubble,
                    ]}
                  >
                    <Text style={styles.messageText}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              )}
            />

            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type mission..."
                  placeholderTextColor="#7D82A8"
                  style={styles.textInput}
                  onSubmitEditing={() => {
                    void handleSendMessage(inputText);
                  }}
                />

                <Pressable
                  onPress={() => {
                    void handleSendMessage(inputText);
                  }}
                  style={styles.sendButton}
                >
                  <Ionicons
                    name="send"
                    size={18}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 12, 0.76)',
  },

  chatCard: {
    width: '92%',
    maxWidth: 540,
    height: '74%',
    borderRadius: 22,
    backgroundColor: '#07051c',
    overflow: 'hidden',
  },

  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#333',
  },

  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  headerButton: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  messageRow: {
    width: '100%',
    marginBottom: 13,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },

  botMessageRow: {
    justifyContent: 'flex-start',
  },

  userMessageRow: {
    justifyContent: 'flex-end',
  },

  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 17,
  },

  botMessageBubble: {
    backgroundColor: '#1c1041',
  },

  userMessageBubble: {
    backgroundColor: '#0f699b',
  },

  messageText: {
    fontSize: 14.5,
    color: '#FFF',
  },

  inputSection: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#04071b',
  },

  textInput: {
    flex: 1,
    color: '#FFF',
    padding: 8,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B2BE2',
  },
});
