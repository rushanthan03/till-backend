import { InitialSchema1660000000000 } from './1660000000000-InitialSchema';
import { UpdateSubscriptionPlanOrderAndLimitValues1670000000000 } from './1670000000000-UpdateSubscriptionPlanOrderAndLimitValues';
import { FixOrderItemAddonUuidTypes1709292929292 } from './1709292929292-FixOrderItemAddonUuidTypes';
import { AddWalletBalanceToRestaurant1733193600000 } from './1733193600000-AddWalletBalanceToRestaurant';
import { AddComprehensiveLimitsToSubscriptionPlans1735992000000 } from './1735992000000-AddComprehensiveLimitsToSubscriptionPlans';
import { CreateSubscriptionChangeLogs1736100000000 } from './1736100000000-CreateSubscriptionChangeLogs';
import { AddTableLimitToSubscriptionPlans1736105000000 } from './1736105000000-AddTableLimitToSubscriptionPlans';
import { FixSubscriptionLogInitiatorAndUuid1736108000000 } from './1736108000000-FixSubscriptionLogInitiatorAndUuid';
import { AddCascadeDeleteToOrderItemAddons1736676000000 } from './1736676000000-AddCascadeDeleteToOrderItemAddons';
import { CreateAlertConfigurationTable1736832000000 } from './1736832000000-CreateAlertConfigurationTable';
import { AddParentOrderIdToOrders1736833000000 } from './1736833000000-AddParentOrderIdToOrders';
import { AddRestaurantSettingsColumns1737000000000 } from './1737000000000-AddRestaurantSettingsColumns';
import { CreateLoyaltyTables1737100000000 } from './1737100000000-CreateLoyaltyTables';
import { AddHotelRoomsFeature1754000000000 } from './1754000000000-AddHotelRoomsFeature';
import { AddRestaurantFeatureFlags1754100000000 } from './1754100000000-AddRestaurantFeatureFlags';
import { AddWhatsAppConfigToRestaurant1754200000000 } from './1754200000000-AddWhatsAppConfigToRestaurant';
import { AddAudioAlertSettingsToRestaurant1754300000000 } from './1754300000000-AddAudioAlertSettingsToRestaurant';
import { CreateOrderAlertAcknowledgements1754350000000 } from './1754350000000-CreateOrderAlertAcknowledgements';
import { AddWhatsAppConfigJsonToRestaurant1754400000000 } from './1754400000000-AddWhatsAppConfigJsonToRestaurant';
import { FixCustomerPhoneAndBaseEntityAuditColumns1754500000000 } from './1754500000000-FixCustomerPhoneAndBaseEntityAuditColumns';
import { AddMissingColumnsAndTables1754550000000 } from './1754550000000-AddMissingColumnsAndTables';
import { AddMissingMenuColumnsAndFixes1754600000000 } from './1754600000000-AddMissingMenuColumnsAndFixes';
import { AddTableNameAndRemainingColumns1754650000000 } from './1754650000000-AddTableNameAndRemainingColumns';
import { ResetSuperAdminPassword1754700000000 } from './1754700000000-ResetSuperAdminPassword';
import { AddSmsSendModeToRestaurant1754800000000 } from './1754800000000-AddSmsSendModeToRestaurant';
import { FixAllMissingColumnsComprehensive1754900000000 } from './1754900000000-FixAllMissingColumnsComprehensive';
import { AddPartialPaymentAndPayLaterLedger1755000000000 } from './1755000000000-AddPartialPaymentAndPayLaterLedger';
import { CreatePosTables1794222900000 } from './1794222900000-CreatePosTables';
import { AddCashierUserRole1794222950000 } from './1794222950000-AddCashierUserRole';
import { AddApprovalsAndDiscounts1794223000000 } from './1794223000000-AddApprovalsAndDiscounts';

export const MIGRATIONS = [
  InitialSchema1660000000000,
  UpdateSubscriptionPlanOrderAndLimitValues1670000000000,
  FixOrderItemAddonUuidTypes1709292929292,
  AddWalletBalanceToRestaurant1733193600000,
  AddComprehensiveLimitsToSubscriptionPlans1735992000000,
  CreateSubscriptionChangeLogs1736100000000,
  AddTableLimitToSubscriptionPlans1736105000000,
  FixSubscriptionLogInitiatorAndUuid1736108000000,
  AddCascadeDeleteToOrderItemAddons1736676000000,
  CreateAlertConfigurationTable1736832000000,
  AddParentOrderIdToOrders1736833000000,
  AddRestaurantSettingsColumns1737000000000,
  CreateLoyaltyTables1737100000000,
  AddHotelRoomsFeature1754000000000,
  AddRestaurantFeatureFlags1754100000000,
  AddWhatsAppConfigToRestaurant1754200000000,
  AddAudioAlertSettingsToRestaurant1754300000000,
  CreateOrderAlertAcknowledgements1754350000000,
  AddWhatsAppConfigJsonToRestaurant1754400000000,
  FixCustomerPhoneAndBaseEntityAuditColumns1754500000000,
  AddMissingColumnsAndTables1754550000000,
  AddMissingMenuColumnsAndFixes1754600000000,
  AddTableNameAndRemainingColumns1754650000000,
  ResetSuperAdminPassword1754700000000,
  AddSmsSendModeToRestaurant1754800000000,
  FixAllMissingColumnsComprehensive1754900000000,
  AddPartialPaymentAndPayLaterLedger1755000000000,
  CreatePosTables1794222900000,
  AddCashierUserRole1794222950000,
  AddApprovalsAndDiscounts1794223000000,
];



