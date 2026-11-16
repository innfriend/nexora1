/**
 * Modular monetization architecture for Nexora Games.
 * Disabled in MVP so single-player racing remains clean, fast, and uninterrupted.
 */

export interface MonetizationConfig {
  enabled: boolean;
  displayAdsEnabled: boolean;
  rewardedVideoEnabled: boolean;
  cosmeticsStoreEnabled: boolean;
}

export interface CosmeticOffer {
  id: string;
  title: string;
  category: 'livery' | 'rims' | 'underglow';
  unlockedByDefault: boolean;
}

export const MONETIZATION_CONFIG: MonetizationConfig = {
  enabled: false,
  displayAdsEnabled: false,
  rewardedVideoEnabled: false,
  cosmeticsStoreEnabled: false,
};

export interface AdPlacementResult {
  shown: boolean;
  rewardGranted: boolean;
}

export async function requestOptionalRewardedAd(_placementId: string): Promise<AdPlacementResult> {
  if (!MONETIZATION_CONFIG.enabled || !MONETIZATION_CONFIG.rewardedVideoEnabled) {
    return { shown: false, rewardGranted: false };
  }
  return { shown: false, rewardGranted: false };
}
