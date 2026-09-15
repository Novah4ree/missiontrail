import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  finishTransaction,
  useIAP,
} from 'expo-iap';

import type {
  Purchase,
} from 'expo-iap';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../../lib/supabase';


// =========================================================
// EXPLORER COIN PRODUCT
// =========================================================
//
// Purpose:
// Keeps Apple's permanent product ID in one clear place.
//
// IMPORTANT:
// The server still decides that this product gives
// exactly 500 Explorer Coins.
// =========================================================

const EXPLORER_COINS_500 =
  'com.missiontrails.explorercoins.500';

const explorerCoinImage =
  require(
    '../../assets/images/MissionTrailsCoin/ExplorerCoins.png'
  );


// =========================================================
// EDGE FUNCTION RESPONSE
// =========================================================

type VerifyPurchaseResponse = {
  verified?: boolean;
  granted?: boolean;
  code?: string;
  coinsGranted?: number;
  balance?: number;
  productId?: string;
};


// =========================================================
// EXPLORER COIN SHOP
// =========================================================

export default function ExplorerCoinShopScreen() {
  const [coinBalance, setCoinBalance] =
    useState(0);

  const [walletLoading, setWalletLoading] =
    useState(true);

  const [purchaseProcessing, setPurchaseProcessing] =
    useState(false);

  const [storeMessage, setStoreMessage] =
    useState<string | null>(null);


  // -------------------------------------------------------
  // Purpose:
  // Reads the user's real Explorer Coin balance
  // from the secure Supabase wallet.
  // -------------------------------------------------------

  const loadWallet = useCallback(async () => {
    try {
      setWalletLoading(true);

      const {
        data,
        error,
      } = await supabase.rpc(
        'server_get_coin_wallet'
      );

      if (error) {
        throw error;
      }

      const wallet =
        data &&
        typeof data === 'object'
          ? data as Record<string, unknown>
          : {};

      setCoinBalance(
        Number(wallet.balance ?? 0)
      );
    } catch (error) {
      console.error(
        'Failed to load Explorer Coin wallet:',
        error
      );
    } finally {
      setWalletLoading(false);
    }
  }, []);


  // -------------------------------------------------------
  // Purpose:
  // Handles a completed Apple purchase.
  //
  // The purchase is NOT finished until our Supabase
  // Edge Function verifies it with Apple and credits
  // the secure Explorer Coin wallet.
  // -------------------------------------------------------

  const handlePurchaseSuccess =
    useCallback(
      async (purchase: Purchase) => {
        if (
          purchase.productId !==
          EXPLORER_COINS_500
        ) {
          console.warn(
            'Ignoring unexpected IAP product:',
            purchase.productId
          );

          return;
        }

        try {
          setPurchaseProcessing(true);
          setStoreMessage(
            'Verifying purchase with Apple...'
          );

          // Purchase.id is the store transaction identifier.
          const transactionId =
            String(purchase.id ?? '').trim();

          if (!transactionId) {
            throw new Error(
              'Apple transaction ID is missing.'
            );
          }


          // -----------------------------------------------
          // Ask our secure server to verify with Apple.
          // -----------------------------------------------

          const {
            data,
            error,
          } = await supabase.functions.invoke(
            'verify-explorer-coin-purchase',
            {
              body: {
                transactionId,
              },
            }
          );


          if (error) {
            throw error;
          }


          const result =
            (data ?? {}) as VerifyPurchaseResponse;


          if (!result.verified) {
            throw new Error(
              result.code ??
              'PURCHASE_NOT_VERIFIED'
            );
          }


          // -----------------------------------------------
          // GRANTED:
          // This purchase just received its coins.
          //
          // ALREADY_GRANTED:
          // The transaction was safely seen before.
          // Do not add coins again, but it is safe to
          // finish the Apple transaction.
          // -----------------------------------------------

          if (
            result.code !== 'GRANTED' &&
            result.code !== 'ALREADY_GRANTED'
          ) {
            throw new Error(
              result.code ??
              'COIN_GRANT_FAILED'
            );
          }


          // -----------------------------------------------
          // Apple purchase is now verified and recorded.
          // Finish the consumable transaction.
          // -----------------------------------------------

          await finishTransaction({
            purchase,
            isConsumable: true,
          });


          await loadWallet();

          setStoreMessage(null);


          if (result.code === 'GRANTED') {
            Alert.alert(
              'Explorer Coins Added 🪙',
              `${Number(
                result.coinsGranted ?? 500
              ).toLocaleString()} Explorer Coins were added to your account.`
            );
          }
        } catch (error) {
          console.error(
            'Explorer Coin verification failed:',
            error
          );

          setStoreMessage(null);

          // IMPORTANT:
          // We intentionally do NOT finish the Apple
          // transaction when verification fails.
          Alert.alert(
            'Purchase Verification',
            'Your purchase could not be verified yet. No Explorer Coins were lost. Please try again.'
          );
        } finally {
          setPurchaseProcessing(false);
        }
      },
      [loadWallet]
    );


  // -------------------------------------------------------
  // Purpose:
  // Handles Apple purchase errors and cancellations.
  // -------------------------------------------------------

  const handlePurchaseError =
    useCallback(
      (error: {
        code?: string;
        message?: string;
      }) => {
        setPurchaseProcessing(false);
        setStoreMessage(null);

        if (
          error.code === 'user-cancelled'
        ) {
          return;
        }

        console.error(
          'Explorer Coin purchase error:',
          error
        );

        Alert.alert(
          'Purchase Failed',
          error.message ??
          'The purchase could not be completed.'
        );
      },
      []
    );


  // -------------------------------------------------------
  // expo-iap manages the StoreKit connection for this page.
  // -------------------------------------------------------

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess:
      handlePurchaseSuccess,

    onPurchaseError:
      handlePurchaseError,
  });


  // -------------------------------------------------------
  // Purpose:
  // Finds Apple's real product information.
  //
  // displayPrice is localized by Apple.
  // Example:
  // $4.99
  // €4.99
  // £4.99
  // etc.
  // -------------------------------------------------------

  const appleProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id ===
          EXPLORER_COINS_500
      ),
    [products]
  );


  // -------------------------------------------------------
  // Purpose:
  // Loads the wallet when the shop opens.
  // -------------------------------------------------------

  useEffect(() => {
    const walletTimer = setTimeout(() => {
      void loadWallet();
    }, 0);

    return () => clearTimeout(walletTimer);
  }, [loadWallet]);


  // -------------------------------------------------------
  // Purpose:
  // Loads Apple's 500 Coin product after StoreKit connects.
  // -------------------------------------------------------

  useEffect(() => {
    if (
      !connected ||
      Platform.OS !== 'ios'
    ) {
      return;
    }

    void fetchProducts({
      skus: [
        EXPLORER_COINS_500,
      ],
      type: 'in-app',
    }).catch((error) => {
      console.error(
        'Failed to load Explorer Coin product:',
        error
      );

      setStoreMessage(
        'Unable to load the App Store price.'
      );
    });
  }, [
    connected,
    fetchProducts,
  ]);


  // -------------------------------------------------------
  // Purpose:
  // Starts Apple's purchase sheet.
  //
  // appAccountToken uses the signed-in Supabase UUID.
  // Apple returns this same UUID with the transaction,
  // allowing our server to confirm who bought the coins.
  // -------------------------------------------------------

  const buy500Coins =
    useCallback(async () => {
      if (Platform.OS !== 'ios') {
        Alert.alert(
          'Coming Soon',
          'Google Play Explorer Coin purchases will be connected separately.'
        );

        return;
      }


      if (!connected) {
        Alert.alert(
          'App Store Connecting',
          'The App Store is still connecting. Try again in a moment.'
        );

        return;
      }


      if (!appleProduct) {
        Alert.alert(
          'Product Loading',
          'The Explorer Coin package is still loading from Apple.'
        );

        return;
      }


      try {
        setPurchaseProcessing(true);
        setStoreMessage(
          'Opening Apple purchase...'
        );


        // -----------------------------------------------
        // Get the currently signed-in Mission Trails user.
        // -----------------------------------------------

        const {
          data,
          error,
        } = await supabase.auth.getUser();


        if (
          error ||
          !data.user
        ) {
          throw new Error(
            'You must be signed in to purchase Explorer Coins.'
          );
        }


        // -----------------------------------------------
        // Start Apple's native purchase flow.
        //
        // Supabase user IDs are UUIDs, which makes them
        // valid Apple appAccountToken values.
        // -----------------------------------------------

        await requestPurchase({
          request: {
            apple: {
              sku:
                EXPLORER_COINS_500,

              quantity: 1,

              appAccountToken:
                data.user.id,
            },
          },

          type: 'in-app',
        });

      } catch (error) {
        setPurchaseProcessing(false);
        setStoreMessage(null);

        console.error(
          'Could not start Explorer Coin purchase:',
          error
        );

        Alert.alert(
          'Unable to Purchase',
          error instanceof Error
            ? error.message
            : 'The purchase could not be started.'
        );
      }
    }, [
      appleProduct,
      connected,
      requestPurchase,
    ]);


  const priceText =
    appleProduct?.displayPrice ??
    (
      connected
        ? 'Loading price...'
        : 'Connecting...'
    );


  const buyDisabled =
    purchaseProcessing ||
    Platform.OS !== 'ios' ||
    !connected ||
    !appleProduct;


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color="#FFFFFF"
            />
          </Pressable>

          <View>
            <Text style={styles.headerEyebrow}>
              MISSION TRAILS
            </Text>

            <Text style={styles.headerTitle}>
              Explorer Coin Shop
            </Text>
          </View>
        </View>


        <View style={styles.walletCard}>
          <Image
            source={explorerCoinImage}
            resizeMode="contain"
            style={styles.walletCoin}
          />

          <View style={styles.walletCopy}>
            <Text style={styles.walletLabel}>
              YOUR EXPLORER COINS
            </Text>

            {walletLoading ? (
              <ActivityIndicator
                size="small"
              />
            ) : (
              <Text style={styles.walletBalance}>
                {coinBalance.toLocaleString()}
              </Text>
            )}
          </View>
        </View>


        <Text style={styles.sectionLabel}>
          GET MORE COINS
        </Text>


        <View style={styles.productCard}>
          <View style={styles.glowCircle}>
            <Image
              source={explorerCoinImage}
              resizeMode="contain"
              style={styles.productCoin}
            />
          </View>

          <Text style={styles.coinAmount}>
            500
          </Text>

          <Text style={styles.coinName}>
            EXPLORER COINS
          </Text>

          <Text style={styles.productDescription}>
            Use Explorer Coins for companion food
            and other eligible Mission Trails items.
          </Text>

          <Text style={styles.price}>
            {priceText}
          </Text>


          <Pressable
            disabled={buyDisabled}
            onPress={buy500Coins}
            style={[
              styles.buyButton,
              buyDisabled &&
                styles.buyButtonDisabled,
            ]}
          >
            {purchaseProcessing ? (
              <ActivityIndicator
                color="#09000D"
              />
            ) : (
              <>
                <Ionicons
                  name="logo-apple"
                  size={19}
                  color="#09000D"
                />

                <Text style={styles.buyButtonText}>
                  BUY 500 COINS
                </Text>
              </>
            )}
          </Pressable>


          {storeMessage ? (
            <Text style={styles.storeMessage}>
              {storeMessage}
            </Text>
          ) : null}


          <View style={styles.storeStatus}>
            <View
              style={[
                styles.statusDot,
                connected
                  ? styles.statusDotConnected
                  : undefined,
              ]}
            />

            <Text style={styles.statusText}>
              {connected
                ? 'App Store connected'
                : 'Connecting to App Store'}
            </Text>
          </View>
        </View>


        <View style={styles.securityCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color="#71F7D4"
          />

          <Text style={styles.securityText}>
            Purchases are processed by Apple.
            Explorer Coins are added only after
            Mission Trails verifies the transaction.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08000E',
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#180D22',
    borderWidth: 1,
    borderColor: '#432A55',
  },

  headerEyebrow: {
    color: '#9C87A8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },

  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#160C20',
    borderWidth: 1,
    borderColor: '#49315B',
    marginBottom: 28,
  },

  walletCoin: {
    width: 62,
    height: 62,
  },

  walletCopy: {
    flex: 1,
    marginLeft: 14,
  },

  walletLabel: {
    color: '#B69CC3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },

  walletBalance: {
    color: '#FFD76A',
    fontSize: 31,
    fontWeight: '900',
    marginTop: 2,
  },

  sectionLabel: {
    color: '#A98CB8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 12,
  },

  productCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#12091A',
    borderWidth: 1,
    borderColor: '#6A3D82',
  },

  glowCircle: {
    width: 142,
    height: 142,
    borderRadius: 71,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#251034',
    borderWidth: 1,
    borderColor: '#8F5BAD',
    marginBottom: 12,
  },

  productCoin: {
    width: 122,
    height: 122,
  },

  coinAmount: {
    color: '#FFD76A',
    fontSize: 42,
    fontWeight: '900',
  },

  coinName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  productDescription: {
    color: '#B6A8BF',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },

  price: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 14,
  },

  buyButton: {
    minWidth: 220,
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#FFD76A',
  },

  buyButtonDisabled: {
    opacity: 0.45,
  },

  buyButtonText: {
    color: '#09000D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  storeMessage: {
    color: '#D7C4DF',
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
  },

  storeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 16,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C5A75',
  },

  statusDotConnected: {
    backgroundColor: '#71F7D4',
  },

  statusText: {
    color: '#907F99',
    fontSize: 11,
  },

  securityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginTop: 18,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#0E1516',
    borderWidth: 1,
    borderColor: '#21443E',
  },

  securityText: {
    flex: 1,
    color: '#A6C9C0',
    fontSize: 12,
    lineHeight: 18,
  },
});
