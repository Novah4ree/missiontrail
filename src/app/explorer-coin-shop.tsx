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
  useState,
} from 'react';

import { supabase } from '../../lib/supabase';


// =========================================================
// EXPLORER COIN PACKS
// =========================================================
//
// Apple supplies the real localized purchase price.
//
// Mission Trails' secure server decides how many Explorer
// Coins each verified Apple product awards.
// =========================================================

const COIN_PACKS = [
  {
    productId:
      'com.missiontrails.explorercoins.500',
    coins: 500,
    name: 'Starter Pack',
    bonus: null,
  },
  {
    productId:
      'com.missiontrails.explorercoins.1100',
    coins: 1100,
    name: 'Explorer Pack',
    bonus: '+100 BONUS COINS',
  },
  {
    productId:
      'com.missiontrails.explorercoins.2400',
    coins: 2400,
    name: 'Adventurer Pack',
    bonus: '+400 BONUS COINS',
  },
  {
    productId:
      'com.missiontrails.explorercoins.6500',
    coins: 6500,
    name: 'Trail Master Pack',
    bonus: '+1,500 BONUS COINS',
  },
  {
    productId:
      'com.missiontrails.explorercoins.14000',
    coins: 14000,
    name: 'Legendary Pack',
    bonus: '+4,000 BONUS COINS',
  },
] as const;

const APPLE_PRODUCT_IDS =
  COIN_PACKS.map(
    (pack) => pack.productId
  );

const VALID_PRODUCT_IDS =
  new Set<string>(
    APPLE_PRODUCT_IDS
  );


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
  detail?: string;
  coinsGranted?: number;
  balance?: number;
  productId?: string;
};


// =========================================================
// EDGE FUNCTION ERROR READER
// =========================================================

async function readPurchaseFunctionError(
  error: unknown
): Promise<string> {

  const candidate =
    error as {
      message?: string;

      context?: {
        json?: () => Promise<unknown>;
      };
    };


  try {
    if (
      candidate.context &&
      typeof candidate.context.json === 'function'
    ) {
      const raw =
        await candidate.context.json();

      if (
        raw &&
        typeof raw === 'object'
      ) {
        const body =
          raw as Record<string, unknown>;

        const code =
          typeof body.code === 'string'
            ? body.code
            : null;

        const detail =
          typeof body.detail === 'string'
            ? body.detail
            : null;

        if (code && detail) {
          return `${code}:${detail}`;
        }

        if (code) {
          return code;
        }
      }
    }
  } catch (parseError) {
    console.warn(
      '[Explorer Coins] Could not read server error:',
      parseError
    );
  }


  if (
    typeof candidate.message === 'string' &&
    candidate.message.trim()
  ) {
    return candidate.message;
  }


  return 'UNKNOWN_PURCHASE_ERROR';
}


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

  const [
    processingProductId,
    setProcessingProductId,
  ] = useState<string | null>(null);

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
        const productId =
          String(
            purchase.productId ?? ''
          );

        if (
          !VALID_PRODUCT_IDS.has(productId)
        ) {
          console.warn(
            'Ignoring unexpected IAP product:',
            productId
          );

          return;
        }

        const pack =
          COIN_PACKS.find(
            (item) =>
              item.productId ===
              productId
          );

        try {
          setPurchaseProcessing(true);
          setProcessingProductId(productId);

          setStoreMessage(
            'Verifying purchase with Apple...'
          );

          // Prefer Apple's StoreKit transaction ID.
          // purchase.id remains as a compatibility fallback
          // for expo-iap versions that expose it there.

          const purchaseWithTransaction =
            purchase as Purchase & {
              transactionId?:
                string | null;
            };

          const transactionId =
            String(
              purchaseWithTransaction.transactionId ??
              purchase.id ??
              ''
            ).trim();

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
            const diagnosticCode =
              await readPurchaseFunctionError(
                error
              );

            console.error(
              '[Explorer Coins] Verification server error:',
              diagnosticCode
            );

            throw new Error(
              diagnosticCode
            );
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

          // Supabase has successfully verified the purchase
          // and credited the wallet at this point.

          const verifiedBalance =
            Number(result.balance);

          if (
            Number.isFinite(
              verifiedBalance
            )
          ) {
            setCoinBalance(
              verifiedBalance
            );
          }


          // IMPORTANT:
          // Only finish Apple's transaction AFTER
          // Mission Trails successfully grants the coins.

          await finishTransaction({
            purchase,
            isConsumable: true,
          });


          // Reload the secure wallet to make absolutely
          // sure the screen and database match.

          await loadWallet();

          setStoreMessage(null);


          if (result.code === 'GRANTED') {
            Alert.alert(
              'Explorer Coins Added 🪙',
              `${Number(
                result.coinsGranted ?? pack?.coins ?? 0
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
          const diagnosticCode =
            error instanceof Error
              ? error.message
              : 'UNKNOWN_PURCHASE_ERROR';

          console.error(
            '[Explorer Coins] Purchase failed:',
            diagnosticCode
          );

          Alert.alert(
            'Purchase Still Processing',
            'Apple received your purchase, but Mission Trails has not finished adding the Explorer Coins yet. Close and reopen the Coin Shop to retry the transaction.'
          );
        } finally {
          setPurchaseProcessing(false);
          setProcessingProductId(null);
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
        setProcessingProductId(null);
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
  // Loads all Explorer Coin products after StoreKit connects.
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
        ...APPLE_PRODUCT_IDS,
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

  const buyCoins =
    useCallback(
      async (productId: string) => {
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


        if (
          !VALID_PRODUCT_IDS.has(productId)
        ) {
          Alert.alert(
            'Unavailable Product',
            'Mission Trails does not recognize this Explorer Coin pack.'
          );

          return;
        }


        const appleProduct =
          products.find(
            (product) =>
              product.id === productId
          );


        if (!appleProduct) {
          Alert.alert(
            'Product Loading',
            'This Explorer Coin pack is still loading from Apple.'
          );

          return;
        }


        try {
          setPurchaseProcessing(true);
          setProcessingProductId(productId);

          setStoreMessage(
            'Opening Apple purchase...'
          );


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


          await requestPurchase({
            request: {
              apple: {
                sku: productId,

                quantity: 1,

                appAccountToken:
                  data.user.id,
              },
            },

            type: 'in-app',
          });

        } catch (error) {
          setPurchaseProcessing(false);
          setProcessingProductId(null);
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
      },
      [
        connected,
        products,
        requestPurchase,
      ]
    );


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


        {COIN_PACKS.map((pack) => {
          const appleProduct =
            products.find(
              (product) =>
                product.id ===
                pack.productId
            );

          const priceText =
            appleProduct?.displayPrice ??
            (
              connected
                ? 'Loading price...'
                : 'Connecting...'
            );

          const isProcessing =
            processingProductId ===
            pack.productId;

          const buyDisabled =
            purchaseProcessing ||
            Platform.OS !== 'ios' ||
            !connected ||
            !appleProduct;

          return (
            <View
              key={pack.productId}
              style={[
                styles.productCard,
                {
                  marginBottom: 14,
                },
              ]}
            >
              <View style={styles.glowCircle}>
                <Image
                  source={explorerCoinImage}
                  resizeMode="contain"
                  style={styles.productCoin}
                />
              </View>

              <Text style={styles.coinAmount}>
                {pack.coins.toLocaleString()}
              </Text>

              <Text style={styles.coinName}>
                {pack.name.toUpperCase()}
              </Text>

              <Text
                style={
                  styles.productDescription
                }
              >
                {pack.bonus
                  ? `${pack.bonus}\nUse Explorer Coins for companion food and other eligible Mission Trails items.`
                  : 'Use Explorer Coins for companion food and other eligible Mission Trails items.'}
              </Text>

              <Text style={styles.price}>
                {priceText}
              </Text>

              <Pressable
                disabled={buyDisabled}
                onPress={() => {
                  void buyCoins(
                    pack.productId
                  );
                }}
                style={[
                  styles.buyButton,
                  buyDisabled &&
                    styles.buyButtonDisabled,
                ]}
              >
                {isProcessing ? (
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

                    <Text
                      style={
                        styles.buyButtonText
                      }
                    >
                      BUY {pack.coins.toLocaleString()}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          );
        })}


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
