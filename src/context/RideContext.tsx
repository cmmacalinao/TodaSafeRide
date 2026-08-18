import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import type {
  AccountingOfficer,
  AccountingOfficerPosition,
  ActivityLogActorRole,
  ActivityLogEntry,
  AdSenseSettings,
  Advertiser,
  AdvertiserPlan,
  AdvertiserStatus,
  BusinessType,
  Campaign,
  CampaignAudience,
  CampaignStatus,
  CampaignType,
  CapitalContribution,
  CoinDirection,
  CoinSource,
  CoinTransaction,
  CorporateRegistrationInfo,
  Coords,
  DocumentType,
  Driver,
  DriverAccessStatus,
  DriverDocuments,
  DriverInvite,
  DriverReport,
  DriverReportReason,
  Distribution,
  DistributionStatus,
  DistributionType,
  DuesRecord,
  DuesType,
  EquityAllocation,
  EquityHolderCategory,
  ExpenseCategory,
  ExpenseRecord,
  FounderContribution,
  FounderContributionKind,
  FounderContributionStatus,
  Franchise,
  GeoCoords,
  IncomePromotionSettings,
  Investor,
  InvestorStatus,
  MedicineCategory,
  MedicineProduct,
  MembershipRequest,
  MembershipRequestType,
  MedsOrder,
  MedsOrderItem,
  MockLocation,
  Operator,
  OrderMessage,
  Parent,
  ParentLink,
  PartnershipRevenueEntry,
  Passenger,
  PaymentAccountDetails,
  PaymentMethod,
  Pharmacy,
  PromoDiscountType,
  PromoOffer,
  PromoOfferKind,
  PromoOfferStatus,
  QueueOfferLogEntry,
  QueueOfferOutcome,
  RccIncentive,
  RccIncentiveBasis,
  RccIncentiveStatus,
  Referral,
  ReferralStatus,
  RewardRules,
  Ride,
  RideCreditTier,
  RideStatus,
  RotaryProject,
  RotaryProjectCategory,
  RotaryProjectStatus,
  SaasPlan,
  SavedLocationLabel,
  ServiceType,
  ShareClass,
  SocialImpactTransaction,
  SocialImpactTransactionCategory,
  SocialImpactTransactionStatus,
  SosAlert,
  SosAlertType,
  Stockholder,
  StockholderType,
  TariffSettings,
  TodaContribution,
  TodaExpenseCategory,
  TodaExpenseRecord,
  TodaOfficer,
  TodaOrganization,
} from '../types'
import {
  DEFAULT_ADSENSE_SETTINGS,
  DEFAULT_CORPORATE_REGISTRATION,
  DEFAULT_INCOME_PROMOTION_SETTINGS,
  DEFAULT_MEDS_DELIVERY_FEE,
  DEFAULT_MEDS_SERVICE_FEE,
  DEFAULT_PABILI_SERVICE_FEE,
  DEFAULT_REWARD_RULES,
  DEFAULT_RIDE_CREDIT_TIERS,
  DEFAULT_TARIFF_SETTINGS,
  DRIVER_BASE_COORDS,
  MINOR_AGE_LIMIT,
  MOCK_ACCOUNTING_OFFICERS,
  MOCK_ADVERTISERS,
  MOCK_CAMPAIGNS,
  MOCK_EQUITY_ALLOCATIONS,
  MOCK_DRIVERS,
  MOCK_FRANCHISES,
  MOCK_MEDICINE_PRODUCTS,
  MOCK_OPERATORS,
  MOCK_PARENTS,
  MOCK_PARENT_LINKS,
  MOCK_PASSENGERS,
  MOCK_PHARMACIES,
  MOCK_TODA_ORGANIZATIONS,
  SAAS_PLAN_FEES,
  estimateFare,
  estimateSpecialPickupFee,
  getActiveTodaCommission,
  getPriorityTodaOrgId,
  getTerminalGps,
  getTodaQueue,
} from '../mock/data'
import { TERMINAL_PROXIMITY_METERS, haversineDistanceMeters } from '../lib/geo'

const STORAGE_KEY = 'tricycle-mock-rides-v21'
const DEFAULT_COMMISSION_PER_RIDE = 5
// How many days an unpaid dues record can go overdue before Admin's driver
// directory flags it as pause-eligible. Admin-adjustable via
// SET_DUES_GRACE_PERIOD_DAYS; this is only the starting default.
const DEFAULT_DUES_GRACE_PERIOD_DAYS = 7
// How many days back a passenger/driver's "Trip history" list shows —
// older rides stay in state (earnings totals, admin reports, ratings all
// still see them) but drop out of that list. Admin-adjustable via
// SET_TRIP_HISTORY_RETENTION_DAYS; this is only the starting default.
const DEFAULT_TRIP_HISTORY_RETENTION_DAYS = 3
// Compressed from the real 2-minute TODA-priority window to match the rest
// of this app's sped-up simulation (rides already complete in ~12s/leg).
// Admin-adjustable at runtime via SET_TODA_QUEUE_WINDOW; this is only the
// default used until Admin changes it.
const DEFAULT_TODA_QUEUE_WINDOW_MS = 60000
// A special pickup (driver detours from the terminal to the passenger's
// exact spot) is a harder ask than a normal terminal pickup, so it gets its
// own — deliberately longer, literal 5-minute — escalation window instead of
// the general todaQueueWindowMs, before opening to any active driver
// (any TODA + freelance; see getDispatchWindow/isRideVisibleToDriver in
// lib/tracking.ts). Admin-adjustable via SET_SPECIAL_PICKUP_ESCALATION_MS.
const DEFAULT_SPECIAL_PICKUP_ESCALATION_MS = 300000
// % of net distributable profit set aside for the Social Impact Fund each
// period — admin-adjustable via SET_SOCIAL_IMPACT_FUND_PCT.
const DEFAULT_SOCIAL_IMPACT_FUND_PCT = 5
// How long a single driver at the front of the terminal queue gets to
// respond before the offer automatically passes to the next driver in
// line. Fixed (not admin-configurable) — the admin-configurable window is
// the overall ceiling before the ride opens to everyone.
const QUEUE_OFFER_TIMEOUT_MS = 6000

const TICK_INTERVAL_MS = 800
const LEG_DURATION_MS = 12000
const PROGRESS_PER_TICK = TICK_INTERVAL_MS / LEG_DURATION_MS
const MAX_LOG_ENTRIES = 200
// Caps the admin/toda-admin change-history list — old enough entries just
// age out rather than growing localStorage unbounded.
const MAX_ACTIVITY_LOG_ENTRIES = 300
const DEVIATION_CHANCE_PER_TICK = 0.12
const DEVIATION_OFFSET_MIN = 10
const DEVIATION_OFFSET_MAX = 18
const MAX_PHOTOS_PER_RIDE = 6
// Small random walk applied to the passenger's simulated phone GPS while
// they're waiting to be picked up, so the marker feels "live" rather than
// pinned dead-center on the pickup point.
const PASSENGER_JITTER_STEP = 1.5

interface RideState {
  rides: Ride[]
  drivers: Driver[]
  passengers: Passenger[]
  parents: Parent[]
  parentLinks: ParentLink[]
  alerts: SosAlert[]
  commissionPerRide: number
  todaQueueWindowMs: number
  specialPickupEscalationMs: number
  todaOrganizations: TodaOrganization[]
  duesRecords: DuesRecord[]
  membershipRequests: MembershipRequest[]
  duesGracePeriodDays: number
  tripHistoryRetentionDays: number
  tariffSettings: TariffSettings
  driverReports: DriverReport[]
  pabiliServiceFee: number
  expenses: ExpenseRecord[]
  // Keyed by ComplianceChecklistItem.id (see mock/data.ts) — true once
  // Admin has marked that item done. Missing keys default to not-done.
  complianceChecked: Record<string, boolean>
  // Same "approve as noted, with a resubmission deadline" pattern as
  // Driver.pendingNote/pendingNoteDeadline — lets the finance officer note
  // what's still missing for a not-yet-done checklist item and give a real
  // deadline to submit it. Missing keys mean no note/deadline set.
  complianceReview: Record<string, { note: string | null; deadlineAt: string | null }>
  capitalContributions: CapitalContribution[]
  todaContributions: TodaContribution[]
  todaExpenses: TodaExpenseRecord[]
  driverInvites: DriverInvite[]
  // The allowlist gating the Accounting & Compliance ("Super Admin") page —
  // see AccountingOfficer in types. Managed from the main Admin dashboard.
  accountingOfficers: AccountingOfficer[]
  // The cap table — see EquityAllocation in types. Lives inside the
  // restricted Accounting & Compliance page, same access gate as the rest
  // of the books.
  equityAllocations: EquityAllocation[]
  // Investment rounds — see Investor in types. Tracked separately from
  // equityAllocations; a round is only mirrored into the cap table when
  // explicitly done from the UI (see "Add to cap table" action).
  investors: Investor[]
  // What backs the Founder's cap-table percentage — see FounderContribution
  // in types.
  founderContributions: FounderContribution[]
  // % of net distributable profit set aside each period — see
  // lib/socialImpact.ts for how it turns into an actual fund_allocation
  // transaction (never automatic; an officer records each period's amount).
  socialImpactFundPct: number
  socialImpactTransactions: SocialImpactTransaction[]
  rotaryProjects: RotaryProject[]
  distributions: Distribution[]
  rccIncentives: RccIncentive[]
  // The formal SEC Articles of Incorporation / GIS-level record — see
  // CorporateRegistrationInfo in types. A single record, not a list.
  corporateRegistration: CorporateRegistrationInfo
  stockholders: Stockholder[]
  // Change-history for the App Admin ("Super Admin") and each TODA's own
  // Admin — see logActivity/ActivityLogEntry. Newest first, capped at
  // MAX_ACTIVITY_LOG_ENTRIES.
  activityLog: ActivityLogEntry[]
  // Income & Promotion module — see types/index.ts's "Income & Promotion"
  // section for the full data-model rationale.
  advertisers: Advertiser[]
  campaigns: Campaign[]
  promoOffers: PromoOffer[]
  rewardRules: RewardRules
  coinTransactions: CoinTransaction[]
  rideCreditTiers: RideCreditTier[]
  referrals: Referral[]
  incomePromotionSettings: IncomePromotionSettings
  partnershipRevenue: PartnershipRevenueEntry[]
  adSenseSettings: AdSenseSettings
  // TODARIDE MEDS — see types/index.ts's Pharmacy/MedicineProduct/MedsOrder
  // comments. medsOrders only cover the pre-dispatch part (browsing, cart,
  // pharmacy confirmation, prescription review); once a pharmacy confirms,
  // a real Ride is created and MedsOrder.linkedRideId points at it.
  pharmacies: Pharmacy[]
  medicineProducts: MedicineProduct[]
  medsOrders: MedsOrder[]
  // TaaS Level 2/3 — see the TODASafeRide-as-a-Service business roadmap.
  // Level 1 (SaaS Partner) lives directly on TodaOrganization's own fields.
  operators: Operator[]
  franchises: Franchise[]
}

type RideAction =
  | {
      type: 'REQUEST_RIDE'
      passengerId: string
      passengerName: string
      passengerPhone: string | null
      pickup: MockLocation
      dropoff: MockLocation
      paymentMethod: PaymentMethod
      isStudentRide: boolean
      isPwdSeniorRide: boolean
      pickupGps: GeoCoords | null
      passengerCount: number
      serviceType: ServiceType
      pabiliItems: string | null
      tip: number
      bookedByParentId: string | null
      specialPickupRequested: boolean
      prescriptionDataUrls: string[]
      seniorIdDataUrl: string | null
      otherDocDataUrl: string | null
      paymentProofDataUrl: string | null
    }
  | { type: 'ACCEPT_RIDE'; rideId: string; driverId: string }
  | { type: 'DECLINE_RIDE'; rideId: string; driverId: string }
  | { type: 'START_RIDE'; rideId: string }
  | { type: 'COMPLETE_RIDE'; rideId: string }
  | { type: 'CANCEL_RIDE'; rideId: string }
  | { type: 'ADD_TIP_OFFER'; rideId: string; amount: number }
  | { type: 'ACKNOWLEDGE_RIDE_PAYMENT'; rideId: string; method: PaymentMethod }
  | { type: 'TICK_POSITIONS' }
  | { type: 'UPDATE_DRIVER_LIVE_GPS'; rideId: string; gps: GeoCoords | null }
  | { type: 'UPDATE_PASSENGER_LIVE_GPS'; rideId: string; gps: GeoCoords | null }
  | { type: 'TRIGGER_SOS'; rideId: string; triggeredBy: string }
  | { type: 'TRIGGER_DRIVER_SOS'; driverId: string; location: GeoCoords | null; notes: string | null }
  | { type: 'RESOLVE_ALERT'; alertId: string }
  | { type: 'APPROVE_DRIVER'; driverId: string }
  | { type: 'REJECT_DRIVER'; driverId: string; reason: string | null }
  | { type: 'APPEAL_DRIVER_REJECTION'; driverId: string; message: string }
  | { type: 'RESUBMIT_DRIVER_DOCUMENT'; driverId: string; docType: DocumentType; dataUrl: string }
  | { type: 'ADD_SAFETY_PHOTO'; rideId: string; dataUrl: string; takenBy: string }
  | { type: 'HYDRATE'; state: RideState }
  | { type: 'SET_COMMISSION'; amount: number }
  | { type: 'JOIN_TERMINAL_QUEUE'; driverId: string; driverGps: GeoCoords | null }
  | { type: 'LEAVE_TERMINAL_QUEUE'; driverId: string }
  | { type: 'SET_TODA_QUEUE_WINDOW'; ms: number }
  | { type: 'SET_SPECIAL_PICKUP_ESCALATION_MS'; ms: number }
  | { type: 'SET_FAVORITE_DRIVER'; passengerId: string; driverId: string | null }
  | { type: 'SET_PARENT_FAVORITE_DRIVER'; parentId: string; driverId: string | null }
  | { type: 'PROPOSE_TODA_COMMISSION'; todaOrgId: string; amount: number | null }
  | { type: 'SET_TODA_COMMISSION_MEMBER_APPROVAL'; todaOrgId: string; approved: boolean }
  | { type: 'SET_TODA_COMMISSION_ADMIN_APPROVAL'; todaOrgId: string; approved: boolean }
  | {
      type: 'ADD_DUES_RECORD'
      todaOrgId: string
      driverIds: string[]
      duesType: DuesType
      label: string
      amount: number
      dueDate: string
    }
  | { type: 'MARK_DUES_PAID'; duesRecordId: string }
  | {
      type: 'REQUEST_MEMBERSHIP_ACTION'
      todaOrgId: string
      driverId: string
      requestType: MembershipRequestType
      reason: string
    }
  | { type: 'RESOLVE_MEMBERSHIP_REQUEST'; requestId: string; approve: boolean }
  | { type: 'SET_DRIVER_ACCESS'; driverId: string; accessStatus: DriverAccessStatus; accessNote: string | null }
  | { type: 'SET_DRIVER_PABILI_PRIORITY'; driverId: string; enabled: boolean }
  | { type: 'SET_DRIVER_ONLINE'; driverId: string; online: boolean }
  | {
      type: 'UPDATE_PASSENGER_PROFILE'
      passengerId: string
      name: string
      phone: string
      email: string | null
      pin: string | null
      paymentDetail: string | null
      password: string | null
      guardianPhone: string | null
    }
  | {
      type: 'UPDATE_DRIVER_PROFILE'
      driverId: string
      name: string
      phone: string
      email: string | null
      pin: string
      paymentDetail: string | null
      password: string | null
      emergencyContact: string | null
    }
  | {
      type: 'UPDATE_PARENT_PROFILE'
      parentId: string
      name: string
      phone: string
      email: string | null
      pin: string | null
      paymentDetail: string | null
      password: string | null
      emergencyContact: string | null
    }
  | {
      type: 'UPDATE_PHARMACY_PROFILE'
      pharmacyId: string
      name: string
      phone: string
      email: string | null
      pin: string
      paymentDetail: string | null
      password: string | null
      emergencyContact: string | null
    }
  | { type: 'SET_DUES_GRACE_PERIOD_DAYS'; days: number }
  | { type: 'SET_TRIP_HISTORY_RETENTION_DAYS'; days: number }
  | { type: 'SET_DRIVER_PENDING_NOTE'; driverId: string; note: string | null; deadline: string | null }
  | {
      type: 'REGISTER_TODA_ORGANIZATION'
      id: string
      name: string
      officers: TodaOfficer[]
      province: string
      city: string
      barangay: string
      addressDetail: string
      terminalGps: GeoCoords | null
      adminPin: string
    }
  | { type: 'APPROVE_TODA_ORG'; todaOrgId: string }
  | { type: 'REJECT_TODA_ORG'; todaOrgId: string }
  | { type: 'SET_TODA_ORG_PENDING_NOTE'; todaOrgId: string; note: string | null; deadline: string | null }
  | { type: 'SET_TODA_SAAS_PLAN'; todaOrgId: string; plan: SaasPlan; perBookingFee: number }
  | { type: 'SET_TODA_OPERATOR'; todaOrgId: string; operatorId: string | null }
  | {
      type: 'REGISTER_OPERATOR'
      id: string
      name: string
      contactPerson: string
      contactPhone: string
      province: string
      city: string
      adminPin: string
    }
  | { type: 'APPROVE_OPERATOR'; operatorId: string }
  | { type: 'REJECT_OPERATOR'; operatorId: string }
  | {
      type: 'SET_OPERATOR_FEES'
      operatorId: string
      activationFee: number | null
      monthlyPlatformFee: number
      perBookingFee: number
    }
  | { type: 'SET_OPERATOR_FRANCHISE'; operatorId: string; franchiseId: string | null }
  | {
      type: 'UPDATE_OPERATOR_PROFILE'
      operatorId: string
      contactPerson: string
      contactPhone: string
      email: string | null
      province: string
      city: string
      barangay: string
      addressDetail: string
      businessRegistrationNo: string | null
    }
  | {
      type: 'REGISTER_FRANCHISE'
      id: string
      name: string
      contactPerson: string
      contactPhone: string
      province: string
      city: string
      adminPin: string
    }
  | { type: 'APPROVE_FRANCHISE'; franchiseId: string }
  | { type: 'REJECT_FRANCHISE'; franchiseId: string }
  | {
      type: 'SET_FRANCHISE_FEES'
      franchiseId: string
      initialFranchiseFee: number | null
      monthlyTechnologyFee: number
      royaltyPct: number | null
    }
  | {
      type: 'UPDATE_FRANCHISE_PROFILE'
      franchiseId: string
      contactPerson: string
      contactPhone: string
      email: string | null
      province: string
      city: string
      barangay: string
      addressDetail: string
      businessRegistrationNo: string | null
    }
  | {
      type: 'ADD_TODA_CONTRIBUTION'
      id: string
      todaOrgId: string
      contributorName: string
      purpose: string
      amount: number
      recordedBy: string
    }
  | { type: 'DELETE_TODA_CONTRIBUTION'; contributionId: string }
  | {
      type: 'ADD_TODA_EXPENSE'
      id: string
      todaOrgId: string
      category: TodaExpenseCategory
      amount: number
      description: string
      recordedBy: string
    }
  | { type: 'DELETE_TODA_EXPENSE'; expenseId: string }
  | { type: 'SET_COMPLIANCE_NOTE'; itemId: string; note: string | null; deadlineAt: string | null }
  | { type: 'SET_TODA_TERMINAL_GPS'; todaOrgId: string; gps: GeoCoords }
  | {
      type: 'SET_TODA_TERMINAL_ADDRESS'
      todaOrgId: string
      province: string
      city: string
      barangay: string
      addressDetail: string
    }
  | { type: 'SET_TARIFF_SETTINGS'; settings: TariffSettings }
  | { type: 'SAVE_PASSENGER_LOCATION'; passengerId: string; id: string; label: SavedLocationLabel; location: MockLocation }
  | { type: 'REMOVE_PASSENGER_LOCATION'; passengerId: string; savedLocationId: string }
  | {
      type: 'RATE_RIDE'
      rideId: string
      driverRating: number
      driverReviewText: string
      todaRating: number | null
      todaReviewText: string
    }
  | {
      type: 'REPORT_DRIVER'
      id: string
      rideId: string
      passengerId: string
      passengerName: string
      driverId: string
      driverName: string
      reason: DriverReportReason
      details: string
    }
  | { type: 'RESOLVE_DRIVER_REPORT'; reportId: string }
  | { type: 'SET_PABILI_SERVICE_FEE'; amount: number }
  | {
      type: 'ADD_EXPENSE'
      id: string
      category: ExpenseCategory
      amount: number
      description: string
      recordedBy: string
    }
  | { type: 'DELETE_EXPENSE'; expenseId: string }
  | { type: 'TOGGLE_COMPLIANCE_ITEM'; itemId: string; done: boolean }
  | {
      type: 'ADD_CAPITAL_CONTRIBUTION'
      id: string
      stockholderName: string
      shares: number
      amount: number
      recordedBy: string
    }
  | { type: 'DELETE_CAPITAL_CONTRIBUTION'; contributionId: string }
  | {
      type: 'ADD_ACCOUNTING_OFFICER'
      id: string
      name: string
      email: string
      position: AccountingOfficerPosition
      otherPositionLabel: string | null
    }
  | { type: 'REMOVE_ACCOUNTING_OFFICER'; officerId: string }
  | {
      type: 'UPDATE_ACCOUNTING_OFFICER'
      officerId: string
      name: string
      email: string
      position: AccountingOfficerPosition
      otherPositionLabel: string | null
    }
  | {
      type: 'ADD_EQUITY_ALLOCATION'
      id: string
      holderName: string
      category: EquityHolderCategory
      otherCategoryLabel: string | null
      percentage: number
      notes: string | null
    }
  | {
      type: 'UPDATE_EQUITY_ALLOCATION'
      allocationId: string
      holderName: string
      category: EquityHolderCategory
      otherCategoryLabel: string | null
      percentage: number
      notes: string | null
    }
  | { type: 'REMOVE_EQUITY_ALLOCATION'; allocationId: string }
  | {
      type: 'ADD_INVESTOR'
      id: string
      investorName: string
      investmentDate: string
      investmentAmount: number
      investmentRound: string
      preMoneyValuation: number | null
      postMoneyValuation: number | null
      sharePercentage: number
      shareClass: ShareClass
      agreementReference: string | null
      status: InvestorStatus
      notes: string | null
    }
  | {
      type: 'UPDATE_INVESTOR'
      investorId: string
      investorName: string
      investmentDate: string
      investmentAmount: number
      investmentRound: string
      preMoneyValuation: number | null
      postMoneyValuation: number | null
      sharePercentage: number
      shareClass: ShareClass
      agreementReference: string | null
      status: InvestorStatus
      notes: string | null
    }
  | { type: 'REMOVE_INVESTOR'; investorId: string }
  | {
      type: 'ADD_FOUNDER_CONTRIBUTION'
      id: string
      founderName: string
      date: string
      contributionType: string
      description: string
      kind: FounderContributionKind
      estimatedValue: number
      supportingDocDataUrl: string | null
    }
  | {
      type: 'UPDATE_FOUNDER_CONTRIBUTION'
      contributionId: string
      founderName: string
      date: string
      contributionType: string
      description: string
      kind: FounderContributionKind
      estimatedValue: number
      supportingDocDataUrl: string | null
    }
  | {
      type: 'SET_FOUNDER_CONTRIBUTION_STATUS'
      contributionId: string
      status: FounderContributionStatus
      approvedValue: number | null
      approvedBy: string
    }
  | { type: 'REMOVE_FOUNDER_CONTRIBUTION'; contributionId: string }
  | { type: 'SET_SOCIAL_IMPACT_FUND_PCT'; pct: number }
  | {
      type: 'ADD_SOCIAL_IMPACT_TRANSACTION'
      id: string
      date: string
      description: string
      amount: number
      projectId: string | null
      category: SocialImpactTransactionCategory
      status: SocialImpactTransactionStatus
      approvedBy: string | null
      supportingDocDataUrl: string | null
    }
  | {
      type: 'SET_SOCIAL_IMPACT_TRANSACTION_STATUS'
      transactionId: string
      status: SocialImpactTransactionStatus
      approvedBy: string
    }
  | { type: 'REMOVE_SOCIAL_IMPACT_TRANSACTION'; transactionId: string }
  | {
      type: 'ADD_ROTARY_PROJECT'
      id: string
      projectName: string
      partner: string
      description: string
      category: RotaryProjectCategory
      approvedBudget: number
      socialImpactFundAllocation: number
      additionalFunding: number
      status: RotaryProjectStatus
      startDate: string | null
      endDate: string | null
    }
  | {
      type: 'UPDATE_ROTARY_PROJECT'
      projectId: string
      projectName: string
      partner: string
      description: string
      category: RotaryProjectCategory
      approvedBudget: number
      socialImpactFundAllocation: number
      additionalFunding: number
      status: RotaryProjectStatus
      startDate: string | null
      endDate: string | null
    }
  | { type: 'REMOVE_ROTARY_PROJECT'; projectId: string }
  | {
      type: 'ADD_DISTRIBUTION'
      id: string
      recipient: string
      distributionType: DistributionType
      amount: number
      date: string
      source: string
      reference: string | null
      status: DistributionStatus
      approvedBy: string | null
    }
  | {
      type: 'UPDATE_DISTRIBUTION'
      distributionId: string
      recipient: string
      distributionType: DistributionType
      amount: number
      date: string
      source: string
      reference: string | null
      status: DistributionStatus
      approvedBy: string | null
    }
  | { type: 'REMOVE_DISTRIBUTION'; distributionId: string }
  | {
      type: 'ADD_RCC_INCENTIVE'
      id: string
      partner: string
      basis: RccIncentiveBasis
      description: string
      amount: number
      date: string
      status: RccIncentiveStatus
      approvedBy: string | null
    }
  | {
      type: 'UPDATE_RCC_INCENTIVE'
      incentiveId: string
      partner: string
      basis: RccIncentiveBasis
      description: string
      amount: number
      date: string
      status: RccIncentiveStatus
      approvedBy: string | null
    }
  | { type: 'REMOVE_RCC_INCENTIVE'; incentiveId: string }
  | { type: 'UPDATE_CORPORATE_REGISTRATION'; info: CorporateRegistrationInfo }
  | {
      type: 'ADD_STOCKHOLDER'
      id: string
      name: string
      nationality: string
      address: string
      stockholderType: StockholderType
      sharesSubscribed: number
      amountSubscribed: number
      amountPaid: number
      dateSubscribed: string | null
      certificateNo: string | null
    }
  | {
      type: 'UPDATE_STOCKHOLDER'
      stockholderId: string
      name: string
      nationality: string
      address: string
      stockholderType: StockholderType
      sharesSubscribed: number
      amountSubscribed: number
      amountPaid: number
      dateSubscribed: string | null
      certificateNo: string | null
    }
  | { type: 'REMOVE_STOCKHOLDER'; stockholderId: string }
  | {
      type: 'REGISTER_DRIVER'
      name: string
      plateNumber: string
      licenseNo: string
      licenseExpiry: string
      pin: string
      documents: DriverDocuments
      todaOrgId: string | null
      province: string
      city: string
      barangay: string
      addressDetail: string
      phone: string
      email: string | null
      facebook: string | null
      inviteId: string | null
    }
  | { type: 'CREATE_DRIVER_INVITE'; id: string; todaOrgId: string; name: string; phone: string; email: string | null }
  | {
      type: 'REGISTER_PASSENGER'
      id: string
      name: string
      age: number
      phone: string
      email: string | null
      pin: string
      province: string
      city: string
      barangay: string
      addressDetail: string
      guardianPhone: string | null
    }
  | {
      type: 'REGISTER_PARENT_WITH_CHILD'
      parentId: string
      childId: string
      parentName: string
      parentPhone: string
      parentEmail: string | null
      parentPin: string
      childName: string
      childAge: number
      childPhone: string
      relationship: string
      province: string
      city: string
      barangay: string
      addressDetail: string
      proofOfAuthorityDataUrl: string | null
    }
  | {
      type: 'ADD_ACTIVITY_LOG_ENTRY'
      id: string
      actorRole: ActivityLogActorRole
      actorName: string
      todaOrgId: string | null
      action: string
      summary: string
      at: string
    }
  | {
      type: 'ADD_ADVERTISER'
      id: string
      businessName: string
      category: string
      province: string
      city: string
      barangay: string
      addressDetail: string
      contactName: string
      contactPhone: string
      contactEmail: string | null
      plan: AdvertiserPlan
      monthlyValue: number
      status: AdvertiserStatus
      notes: string | null
    }
  | {
      type: 'UPDATE_ADVERTISER'
      advertiserId: string
      businessName: string
      category: string
      province: string
      city: string
      barangay: string
      addressDetail: string
      contactName: string
      contactPhone: string
      contactEmail: string | null
      plan: AdvertiserPlan
      monthlyValue: number
      status: AdvertiserStatus
      notes: string | null
    }
  | { type: 'REMOVE_ADVERTISER'; advertiserId: string }
  | {
      type: 'ADD_CAMPAIGN'
      id: string
      name: string
      description: string
      campaignType: CampaignType
      targetAudience: CampaignAudience
      startDate: string
      endDate: string | null
      rewardCoins: number
      rewardNote: string | null
      budget: number
      dailyLimit: number | null
      weeklyLimit: number | null
      monthlyLimit: number | null
      status: CampaignStatus
      advertiserId: string | null
    }
  | {
      type: 'UPDATE_CAMPAIGN'
      campaignId: string
      name: string
      description: string
      campaignType: CampaignType
      targetAudience: CampaignAudience
      startDate: string
      endDate: string | null
      rewardCoins: number
      rewardNote: string | null
      budget: number
      dailyLimit: number | null
      weeklyLimit: number | null
      monthlyLimit: number | null
      status: CampaignStatus
      advertiserId: string | null
    }
  | { type: 'SET_CAMPAIGN_STATUS'; campaignId: string; status: CampaignStatus }
  | { type: 'UPDATE_CAMPAIGN_METRICS'; campaignId: string; reach: number; clicks: number; shares: number; participants: number }
  | { type: 'REMOVE_CAMPAIGN'; campaignId: string }
  | {
      type: 'ADD_PROMO_OFFER'
      id: string
      title: string
      description: string
      kind: PromoOfferKind
      discountType: PromoDiscountType
      discountValue: number
      code: string | null
      startDate: string
      endDate: string | null
      usageLimit: number | null
      status: PromoOfferStatus
    }
  | {
      type: 'UPDATE_PROMO_OFFER'
      offerId: string
      title: string
      description: string
      kind: PromoOfferKind
      discountType: PromoDiscountType
      discountValue: number
      code: string | null
      startDate: string
      endDate: string | null
      usageLimit: number | null
      status: PromoOfferStatus
    }
  | { type: 'SET_PROMO_OFFER_STATUS'; offerId: string; status: PromoOfferStatus }
  | { type: 'REMOVE_PROMO_OFFER'; offerId: string }
  | { type: 'SET_REWARD_RULES'; rules: RewardRules }
  | {
      type: 'ADD_COIN_TRANSACTION'
      id: string
      actorType: 'passenger' | 'driver'
      actorId: string
      actorName: string
      direction: CoinDirection
      source: CoinSource
      amount: number
      campaignId: string | null
      note: string | null
      recordedBy: string
    }
  | { type: 'REMOVE_COIN_TRANSACTION'; transactionId: string }
  | { type: 'ADD_RIDE_CREDIT_TIER'; id: string; coins: number; pesoValue: number }
  | { type: 'UPDATE_RIDE_CREDIT_TIER'; tierId: string; coins: number; pesoValue: number }
  | { type: 'REMOVE_RIDE_CREDIT_TIER'; tierId: string }
  | {
      type: 'ADD_REFERRAL'
      id: string
      code: string
      referrerId: string
      referrerName: string
      referrerType: 'passenger' | 'driver'
      referredName: string
      referredPassengerId: string | null
      campaignId: string | null
    }
  | {
      type: 'SET_REFERRAL_STATUS'
      referralId: string
      status: ReferralStatus
      coinsAwarded: number
    }
  | { type: 'REMOVE_REFERRAL'; referralId: string }
  | { type: 'SET_INCOME_PROMOTION_SETTINGS'; settings: IncomePromotionSettings }
  | {
      type: 'ADD_PARTNERSHIP_REVENUE'
      id: string
      partnerName: string
      description: string
      amount: number
      recordedBy: string
    }
  | { type: 'REMOVE_PARTNERSHIP_REVENUE'; entryId: string }
  | { type: 'SET_ADSENSE_SETTINGS'; settings: AdSenseSettings }
  // TODARIDE MEDS — pre-dispatch order lifecycle: CREATE_MEDS_ORDER (customer
  // asks for a quote) -> PHARMACY_SEND_QUOTE (pharmacy prices the items) ->
  // CUSTOMER_ACCEPT_QUOTE (customer checks out — only now may the pharmacy
  // proceed) -> PHARMACY_PROCESS_MEDS_ORDER, which either dispatches a real
  // Ride immediately (deliveryMode 'pharmacy_books', same REQUEST_RIDE
  // construction the rest of the app already uses) or leaves the order at
  // 'ready_for_pickup' for the customer to dispatch themselves via
  // MEDS_ORDER_BOOK_OWN_RIDE ('self_book'). Once a Ride exists, everything
  // past that point is ordinary ride dispatch/tracking, not a MEDS-specific
  // action.
  | {
      type: 'CREATE_MEDS_ORDER'
      customerId: string
      customerName: string
      pharmacyId: string
      items: MedsOrderItem[]
      deliveryAddress: MockLocation
      prescriptionDataUrls: string[]
      paymentMethod: PaymentMethod
      deliveryMode: 'pharmacy_books' | 'self_book'
    }
  | { type: 'PHARMACY_SEND_QUOTE'; orderId: string; items: MedsOrderItem[]; receiptDataUrl: string | null }
  | { type: 'PHARMACY_REJECT_MEDS_ORDER'; orderId: string; reason: string }
  | { type: 'REVIEW_MEDS_PRESCRIPTION'; orderId: string; approved: boolean; reason: string | null }
  | {
      type: 'CUSTOMER_ACCEPT_QUOTE'
      orderId: string
      paymentMethod: PaymentMethod
      paymentProofDataUrl: string | null
      deliveryMode: 'pharmacy_books' | 'self_book'
    }
  | { type: 'CANCEL_MEDS_ORDER'; orderId: string }
  | { type: 'SEND_MEDS_ORDER_MESSAGE'; orderId: string; sender: 'customer' | 'pharmacy'; text: string }
  | { type: 'PHARMACY_PROCESS_MEDS_ORDER'; orderId: string }
  | { type: 'MEDS_ORDER_BOOK_OWN_RIDE'; orderId: string }
  | { type: 'TOGGLE_MEDICINE_PRODUCT_STOCK'; productId: string }
  | {
      type: 'REGISTER_PHARMACY'
      id: string
      name: string
      businessType: BusinessType
      contactPhone: string
      province: string
      city: string
      barangay: string
      addressDetail: string
      coords: Coords
      locationGps: GeoCoords | null
      adminPin: string
    }
  | {
      type: 'ADD_MEDICINE_PRODUCT'
      id: string
      pharmacyId: string
      name: string
      genericName: string | null
      category: MedicineCategory
      price: number
    }
  | {
      type: 'UPDATE_PHARMACY_PAYMENT_ACCOUNT'
      pharmacyId: string
      method: 'gcash' | 'maya'
      details: PaymentAccountDetails | null
    }

interface StoredState {
  rides: Ride[]
  alerts: SosAlert[]
  drivers: Driver[]
  passengers?: Passenger[]
  parents?: Parent[]
  parentLinks?: ParentLink[]
  commissionPerRide?: number
  todaQueueWindowMs?: number
  specialPickupEscalationMs?: number
  todaOrganizations?: TodaOrganization[]
  duesRecords?: DuesRecord[]
  membershipRequests?: MembershipRequest[]
  duesGracePeriodDays?: number
  tripHistoryRetentionDays?: number
  tariffSettings?: TariffSettings
  driverReports?: DriverReport[]
  pabiliServiceFee?: number
  expenses?: ExpenseRecord[]
  complianceChecked?: Record<string, boolean>
  complianceReview?: Record<string, { note: string | null; deadlineAt: string | null }>
  capitalContributions?: CapitalContribution[]
  todaContributions?: TodaContribution[]
  todaExpenses?: TodaExpenseRecord[]
  driverInvites?: DriverInvite[]
  accountingOfficers?: AccountingOfficer[]
  equityAllocations?: EquityAllocation[]
  investors?: Investor[]
  founderContributions?: FounderContribution[]
  socialImpactFundPct?: number
  socialImpactTransactions?: SocialImpactTransaction[]
  rotaryProjects?: RotaryProject[]
  distributions?: Distribution[]
  rccIncentives?: RccIncentive[]
  corporateRegistration?: CorporateRegistrationInfo
  stockholders?: Stockholder[]
  activityLog?: ActivityLogEntry[]
  advertisers?: Advertiser[]
  campaigns?: Campaign[]
  promoOffers?: PromoOffer[]
  rewardRules?: RewardRules
  coinTransactions?: CoinTransaction[]
  rideCreditTiers?: RideCreditTier[]
  referrals?: Referral[]
  incomePromotionSettings?: IncomePromotionSettings
  partnershipRevenue?: PartnershipRevenueEntry[]
  adSenseSettings?: AdSenseSettings
  pharmacies?: Pharmacy[]
  medicineProducts?: MedicineProduct[]
  medsOrders?: MedsOrder[]
  operators?: Operator[]
  franchises?: Franchise[]
}

// PIN/email were added to Driver/Passenger/Parent after this app already had
// users with data saved in localStorage — without this, anyone's
// already-stored account would be missing both fields (silently breaking PIN
// login) until they cleared storage. Backfills a deterministic PIN (last 4
// phone digits, matching how the seed mock accounts were assigned theirs) so
// existing accounts get a working PIN instead of a permanently broken one.
function lastFourDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-4) || '0000'
}

function fromStored(parsed: StoredState): RideState {
  const parentLinks = parsed.parentLinks ?? MOCK_PARENT_LINKS
  // A passenger linked as someone's child doesn't log in on their own (see
  // REGISTER_PARENT_WITH_CHILD), so it shouldn't get a backfilled PIN either
  // — guardianPhone isn't a reliable signal for this (a self-registered
  // senior/PWD adult also has none).
  const linkedChildIds = new Set(parentLinks.map((l) => l.studentPassengerId))
  return {
    rides: parsed.rides,
    alerts: parsed.alerts,
    drivers: (parsed.drivers ?? []).map((d) => ({ ...d, email: d.email ?? null, facebook: d.facebook ?? null })),
    passengers: (parsed.passengers ?? MOCK_PASSENGERS).map((p) => ({
      ...p,
      email: p.email ?? null,
      pin: p.pin ?? (linkedChildIds.has(p.id) ? null : lastFourDigits(p.phone)),
    })),
    parents: (parsed.parents ?? MOCK_PARENTS).map((p) => ({
      ...p,
      email: p.email ?? null,
      pin: p.pin ?? lastFourDigits(p.phone),
    })),
    parentLinks,
    commissionPerRide: parsed.commissionPerRide ?? DEFAULT_COMMISSION_PER_RIDE,
    todaQueueWindowMs: parsed.todaQueueWindowMs ?? DEFAULT_TODA_QUEUE_WINDOW_MS,
    specialPickupEscalationMs: parsed.specialPickupEscalationMs ?? DEFAULT_SPECIAL_PICKUP_ESCALATION_MS,
    // Older saved sessions predate TaaS Level 1 (SaaS Partner) fields —
    // default each org to the cheapest plan/direct-to-HQ rather than leaving
    // them undefined (would render blank/NaN in SubscriptionSection).
    todaOrganizations: (parsed.todaOrganizations ?? MOCK_TODA_ORGANIZATIONS).map((o) => ({
      ...o,
      saasPlan: o.saasPlan ?? 'starter',
      monthlyPlatformFee: o.monthlyPlatformFee ?? SAAS_PLAN_FEES.starter,
      perBookingFee: o.perBookingFee ?? 0,
      operatorId: o.operatorId ?? null,
    })),
    duesRecords: parsed.duesRecords ?? [],
    membershipRequests: parsed.membershipRequests ?? [],
    duesGracePeriodDays: parsed.duesGracePeriodDays ?? DEFAULT_DUES_GRACE_PERIOD_DAYS,
    tripHistoryRetentionDays: parsed.tripHistoryRetentionDays ?? DEFAULT_TRIP_HISTORY_RETENTION_DAYS,
    tariffSettings: { ...DEFAULT_TARIFF_SETTINGS, ...parsed.tariffSettings },
    driverReports: parsed.driverReports ?? [],
    pabiliServiceFee: parsed.pabiliServiceFee ?? DEFAULT_PABILI_SERVICE_FEE,
    expenses: parsed.expenses ?? [],
    complianceChecked: parsed.complianceChecked ?? {},
    complianceReview: parsed.complianceReview ?? {},
    capitalContributions: parsed.capitalContributions ?? [],
    todaContributions: parsed.todaContributions ?? [],
    todaExpenses: parsed.todaExpenses ?? [],
    driverInvites: parsed.driverInvites ?? [],
    accountingOfficers: parsed.accountingOfficers ?? MOCK_ACCOUNTING_OFFICERS,
    equityAllocations: parsed.equityAllocations ?? MOCK_EQUITY_ALLOCATIONS,
    investors: parsed.investors ?? [],
    founderContributions: parsed.founderContributions ?? [],
    socialImpactFundPct: parsed.socialImpactFundPct ?? DEFAULT_SOCIAL_IMPACT_FUND_PCT,
    socialImpactTransactions: parsed.socialImpactTransactions ?? [],
    rotaryProjects: parsed.rotaryProjects ?? [],
    distributions: parsed.distributions ?? [],
    rccIncentives: parsed.rccIncentives ?? [],
    corporateRegistration: { ...DEFAULT_CORPORATE_REGISTRATION, ...parsed.corporateRegistration },
    stockholders: parsed.stockholders ?? [],
    activityLog: parsed.activityLog ?? [],
    advertisers: parsed.advertisers ?? MOCK_ADVERTISERS,
    campaigns: parsed.campaigns ?? MOCK_CAMPAIGNS,
    promoOffers: parsed.promoOffers ?? [],
    rewardRules: { ...DEFAULT_REWARD_RULES, ...parsed.rewardRules },
    coinTransactions: parsed.coinTransactions ?? [],
    rideCreditTiers: parsed.rideCreditTiers ?? DEFAULT_RIDE_CREDIT_TIERS,
    referrals: parsed.referrals ?? [],
    incomePromotionSettings: { ...DEFAULT_INCOME_PROMOTION_SETTINGS, ...parsed.incomePromotionSettings },
    partnershipRevenue: parsed.partnershipRevenue ?? [],
    adSenseSettings: { ...DEFAULT_ADSENSE_SETTINGS, ...parsed.adSenseSettings, slots: { ...DEFAULT_ADSENSE_SETTINGS.slots, ...parsed.adSenseSettings?.slots } },
    pharmacies: parsed.pharmacies ?? MOCK_PHARMACIES,
    medicineProducts: parsed.medicineProducts ?? MOCK_MEDICINE_PRODUCTS,
    // Older saved sessions predate the order-chat feature — default each
    // order's messages to an empty array rather than crashing on .map/.length.
    medsOrders: (parsed.medsOrders ?? []).map((o: MedsOrder) => ({ ...o, messages: o.messages ?? [] })),
    // Older saved sessions predate the Operator/Franchise business-profile
    // fields (email/barangay/addressDetail/businessRegistrationNo) — same
    // backfill approach as todaOrganizations above.
    operators: (parsed.operators ?? MOCK_OPERATORS).map((o) => ({
      ...o,
      email: o.email ?? null,
      barangay: o.barangay ?? '',
      addressDetail: o.addressDetail ?? '',
      businessRegistrationNo: o.businessRegistrationNo ?? null,
    })),
    franchises: (parsed.franchises ?? MOCK_FRANCHISES).map((f) => ({
      ...f,
      email: f.email ?? null,
      barangay: f.barangay ?? '',
      addressDetail: f.addressDetail ?? '',
      businessRegistrationNo: f.businessRegistrationNo ?? null,
    })),
  }
}

function loadInitialState(): RideState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return fromStored(JSON.parse(raw) as StoredState)
  } catch {
    // ignore corrupt storage
  }
  return {
    rides: [],
    alerts: [],
    drivers: MOCK_DRIVERS,
    passengers: MOCK_PASSENGERS,
    parents: MOCK_PARENTS,
    parentLinks: MOCK_PARENT_LINKS,
    commissionPerRide: DEFAULT_COMMISSION_PER_RIDE,
    todaQueueWindowMs: DEFAULT_TODA_QUEUE_WINDOW_MS,
    specialPickupEscalationMs: DEFAULT_SPECIAL_PICKUP_ESCALATION_MS,
    todaOrganizations: MOCK_TODA_ORGANIZATIONS,
    duesRecords: [],
    membershipRequests: [],
    duesGracePeriodDays: DEFAULT_DUES_GRACE_PERIOD_DAYS,
    tripHistoryRetentionDays: DEFAULT_TRIP_HISTORY_RETENTION_DAYS,
    tariffSettings: DEFAULT_TARIFF_SETTINGS,
    driverReports: [],
    pabiliServiceFee: DEFAULT_PABILI_SERVICE_FEE,
    expenses: [],
    complianceChecked: {},
    complianceReview: {},
    capitalContributions: [],
    todaContributions: [],
    todaExpenses: [],
    driverInvites: [],
    accountingOfficers: MOCK_ACCOUNTING_OFFICERS,
    equityAllocations: MOCK_EQUITY_ALLOCATIONS,
    investors: [],
    founderContributions: [],
    socialImpactFundPct: DEFAULT_SOCIAL_IMPACT_FUND_PCT,
    socialImpactTransactions: [],
    rotaryProjects: [],
    distributions: [],
    rccIncentives: [],
    corporateRegistration: DEFAULT_CORPORATE_REGISTRATION,
    stockholders: [],
    activityLog: [],
    advertisers: MOCK_ADVERTISERS,
    campaigns: MOCK_CAMPAIGNS,
    promoOffers: [],
    rewardRules: DEFAULT_REWARD_RULES,
    coinTransactions: [],
    rideCreditTiers: DEFAULT_RIDE_CREDIT_TIERS,
    referrals: [],
    incomePromotionSettings: DEFAULT_INCOME_PROMOTION_SETTINGS,
    partnershipRevenue: [],
    adSenseSettings: DEFAULT_ADSENSE_SETTINGS,
    pharmacies: MOCK_PHARMACIES,
    medicineProducts: MOCK_MEDICINE_PRODUCTS,
    medsOrders: [],
    operators: MOCK_OPERATORS,
    franchises: MOCK_FRANCHISES,
  }
}

function lerp(from: Coords, to: Coords, t: number): Coords {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function legOrigin(ride: Ride): Coords {
  return ride.status === 'ongoing' ? ride.pickup.coords : DRIVER_BASE_COORDS
}

function legDestination(ride: Ride): Coords {
  return ride.status === 'ongoing' ? ride.dropoff.coords : ride.pickup.coords
}

function generateReferenceNo(): string {
  return `PM-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
}

function randomOffset(): Coords {
  const magnitude = DEVIATION_OFFSET_MIN + Math.random() * (DEVIATION_OFFSET_MAX - DEVIATION_OFFSET_MIN)
  const angle = Math.random() * Math.PI * 2
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude }
}

function clampToMap(value: number): number {
  return Math.min(96, Math.max(4, value))
}

// A ride's `passengerId` is either a real Passenger's id, or — for a
// parent's self-booking, which has no separate Passenger record — the
// Parent's own id. Check both so the favorite-driver preference applies
// either way.
function findFavoriteDriverId(state: RideState, passengerId: string): string | null {
  return (
    state.passengers.find((p) => p.id === passengerId)?.favoriteDriverId ??
    state.parents.find((p) => p.id === passengerId)?.favoriteDriverId ??
    null
  )
}

// TODARIDE MEDS — builds the actual delivery Ride for a confirmed order,
// shared by both dispatch paths: PHARMACY_PROCESS_MEDS_ORDER (deliveryMode
// 'pharmacy_books', dispatches immediately) and MEDS_ORDER_BOOK_OWN_RIDE
// (deliveryMode 'self_book', dispatches whenever the customer taps "Book my
// ride now"). Same construction REQUEST_RIDE already uses — the pharmacy
// becomes the Ride's "pickup" (abstract coords for the fare/priority-dispatch
// simulation, real gps for the live map), the order's delivery address
// becomes "dropoff".
function buildMedsDeliveryRide(state: RideState, order: MedsOrder, pharmacy: Pharmacy): Ride {
  const pickup: MockLocation = {
    id: pharmacy.id,
    label: pharmacy.name,
    coords: pharmacy.coords,
    gps: pharmacy.locationGps ?? { lat: 15.7940977, lng: 120.9905849 },
    province: pharmacy.province,
    city: pharmacy.city,
    barangay: pharmacy.barangay,
  }
  const dropoff = order.deliveryAddress
  const priorityTodaOrgId = getPriorityTodaOrgId(pickup)
  const { offeredDriverId, offeredAt } = nextQueueOffer(
    priorityTodaOrgId,
    [],
    state.drivers,
    findFavoriteDriverId(state, order.customerId),
    true,
  )
  const itemsSummary = order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')
  return {
    id: `ride-${Date.now()}`,
    passengerId: order.customerId,
    passengerName: order.customerName,
    passengerPhone: null,
    driverId: null,
    driverName: null,
    pickup,
    dropoff,
    // Normally the medicine subtotal was already settled with the pharmacy
    // online when the customer accepted the quote (see CUSTOMER_ACCEPT_QUOTE)
    // — the driver's own fare is then just the delivery + service fee, same
    // as a normal Pabili errand's fareEstimate never including the cost of
    // the goods themselves. But when online payment wasn't available/working
    // and the customer opted for "driver pays, I reimburse on delivery" (see
    // ActiveOrderCard's cash fallback), paymentMethod is 'cash' and nothing
    // was ever paid to the pharmacy — the driver fronts the medicine cost at
    // pickup, so their fare must include it to be reimbursed in full on
    // delivery, same as Pabili's driver-fronts-the-goods model.
    fareEstimate: order.paymentMethod === 'cash' ? order.total : order.deliveryFee + order.serviceFee,
    status: 'requested',
    requestedAt: new Date().toISOString(),
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    driverPosition: null,
    passengerPosition: null,
    pickupGps: null,
    driverLiveGps: null,
    driverLiveGpsAt: null,
    passengerLiveGps: null,
    passengerLiveGpsAt: null,
    legProgress: 0,
    locationLog: [],
    paymentMethod: order.paymentMethod,
    payment: null,
    isStudentRide: false,
    isPwdSeniorRide: false,
    routeAlert: false,
    deviationOffset: null,
    safetyPhotos: [],
    priorityTodaOrgId,
    priorityQueueOfferedDriverId: offeredDriverId,
    priorityQueueOfferedAt: offeredAt,
    priorityQueueLog: [],
    passengerCount: 1,
    driverRating: null,
    driverReviewText: null,
    todaRating: null,
    todaReviewText: null,
    ratedAt: null,
    serviceType: 'buy_medicine',
    pabiliItems: itemsSummary,
    pabiliTip: 0,
    pabiliServiceFee: order.serviceFee,
    prescriptionDataUrls: order.prescriptionDataUrls,
    seniorIdDataUrl: null,
    otherDocDataUrl: null,
    // The order's own paymentProofDataUrl (uploaded against the medicine
    // subtotal paid to the pharmacy) lives on the MedsOrder, not this Ride —
    // this field is only for the Pabili store-QR flow (see REQUEST_RIDE).
    paymentProofDataUrl: null,
    bookedByParentId: null,
    specialPickupRequested: false,
    specialPickupFee: 0,
    tipOffer: 0,
    paymentAcknowledged: false,
  }
}

// Finds who should be offered this ride next: the passenger's favorite
// driver gets first crack (if eligible and not already offered-and-passed),
// then whoever's next in the priority TODA's terminal queue — except for a
// Pabili errand, where drivers who've opted into pabiliPriority are moved to
// the front of that queue (still in join order among themselves), since
// they've specifically said they want first crack at Pabili work. Returns a
// "nobody left" result once both are exhausted, which callers treat as an
// immediate open-to-all (see isRideVisibleToDriver in lib/tracking.ts).
function nextQueueOffer(
  priorityTodaOrgId: string | null,
  priorityQueueLog: QueueOfferLogEntry[],
  drivers: Driver[],
  favoriteDriverId: string | null = null,
  isPabili = false,
): { offeredDriverId: string | null; offeredAt: string | null } {
  const alreadyOffered = new Set(priorityQueueLog.map((entry) => entry.driverId))
  const favorite = favoriteDriverId ? drivers.find((d) => d.id === favoriteDriverId) : null
  if (
    favorite &&
    !alreadyOffered.has(favorite.id) &&
    favorite.verificationStatus === 'approved' &&
    favorite.accessStatus === 'active'
  ) {
    return { offeredDriverId: favorite.id, offeredAt: new Date().toISOString() }
  }
  if (!priorityTodaOrgId) return { offeredDriverId: null, offeredAt: null }
  const queue = getTodaQueue(priorityTodaOrgId, drivers)
  // Array.prototype.sort is stable (ES2019+), so this only pulls
  // pabiliPriority drivers ahead — it doesn't disturb join order within
  // either group.
  const orderedQueue = isPabili ? [...queue].sort((a, b) => Number(b.pabiliPriority) - Number(a.pabiliPriority)) : queue
  const next = orderedQueue.find((d) => !alreadyOffered.has(d.id))
  return next ? { offeredDriverId: next.id, offeredAt: new Date().toISOString() } : { offeredDriverId: null, offeredAt: null }
}

// Records that the currently-offered driver passed on this ride (either by
// explicitly declining or by not responding within QUEUE_OFFER_TIMEOUT_MS),
// then advances the offer to whoever's next (favorite, then terminal queue).
function skipCurrentOffer(
  ride: Ride,
  drivers: Driver[],
  outcome: QueueOfferOutcome,
  favoriteDriverId: string | null = null,
): Ride {
  if (!ride.priorityQueueOfferedDriverId) return ride
  const skippedDriver = drivers.find((d) => d.id === ride.priorityQueueOfferedDriverId)
  const logEntry: QueueOfferLogEntry = {
    driverId: ride.priorityQueueOfferedDriverId,
    driverName: skippedDriver?.name ?? 'Driver',
    outcome,
    at: new Date().toISOString(),
  }
  const priorityQueueLog = [...ride.priorityQueueLog, logEntry]
  const { offeredDriverId, offeredAt } = nextQueueOffer(
    ride.priorityTodaOrgId,
    priorityQueueLog,
    drivers,
    favoriteDriverId,
    ride.serviceType !== 'ride',
  )
  return { ...ride, priorityQueueLog, priorityQueueOfferedDriverId: offeredDriverId, priorityQueueOfferedAt: offeredAt }
}

function makeAlert(
  rideId: string,
  triggeredBy: string,
  type: SosAlertType,
  notes: string,
  guardianNotifiedPhone: string | null = null,
): SosAlert {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    rideId,
    triggeredBy,
    type,
    status: 'open',
    notes,
    createdAt: new Date().toISOString(),
    guardianNotifiedPhone,
  }
}

function reducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case 'REQUEST_RIDE': {
      const priorityTodaOrgId = getPriorityTodaOrgId(action.pickup)
      const { offeredDriverId, offeredAt } = nextQueueOffer(
        priorityTodaOrgId,
        [],
        state.drivers,
        findFavoriteDriverId(state, action.passengerId),
        action.serviceType !== 'ride',
      )
      const pabiliServiceFee = action.serviceType !== 'ride' ? state.pabiliServiceFee : 0
      const oneWayFare = estimateFare(action.pickup, action.dropoff, state.tariffSettings, {
        isStudent: action.isStudentRide,
        isPwdSenior: action.isPwdSeniorRide,
        passengerCount: action.passengerCount,
      })
      // A Pabili/Buy Medicine errand is a round trip for the driver (store
      // and back), not a one-way ride — charge 2x the standard distance
      // fare to cover that, on top of the flat pabiliServiceFee for their
      // time.
      const baseFare = action.serviceType !== 'ride' ? oneWayFare * 2 : oneWayFare
      // Special pickup: the driver detours from the terminal to the
      // passenger's exact gps instead of waiting for them there — a
      // one-time detour, not doubled for Pabili's round trip.
      const terminalGps = getTerminalGps(state.todaOrganizations.find((o) => o.id === priorityTodaOrgId))
      const specialPickupFee = action.specialPickupRequested
        ? estimateSpecialPickupFee(terminalGps, action.pickupGps, state.tariffSettings)
        : 0
      const ride: Ride = {
        id: `ride-${Date.now()}`,
        passengerId: action.passengerId,
        passengerName: action.passengerName,
        passengerPhone: action.passengerPhone,
        driverId: null,
        driverName: null,
        pickup: action.pickup,
        dropoff: action.dropoff,
        fareEstimate: baseFare + pabiliServiceFee + specialPickupFee,
        status: 'requested' as RideStatus,
        requestedAt: new Date().toISOString(),
        acceptedAt: null,
        startedAt: null,
        completedAt: null,
        driverPosition: null,
        passengerPosition: null,
        pickupGps: action.pickupGps,
        driverLiveGps: null,
        driverLiveGpsAt: null,
        passengerLiveGps: null,
        passengerLiveGpsAt: null,
        legProgress: 0,
        locationLog: [],
        paymentMethod: action.paymentMethod,
        payment: null,
        isStudentRide: action.isStudentRide,
        isPwdSeniorRide: action.isPwdSeniorRide,
        routeAlert: false,
        deviationOffset: null,
        safetyPhotos: [],
        priorityTodaOrgId,
        priorityQueueOfferedDriverId: offeredDriverId,
        priorityQueueOfferedAt: offeredAt,
        priorityQueueLog: [],
        passengerCount: action.passengerCount,
        driverRating: null,
        driverReviewText: null,
        todaRating: null,
        todaReviewText: null,
        ratedAt: null,
        serviceType: action.serviceType,
        pabiliItems: action.serviceType !== 'ride' ? action.pabiliItems : null,
        pabiliTip: action.serviceType !== 'ride' ? action.tip : 0,
        pabiliServiceFee,
        prescriptionDataUrls: action.serviceType === 'buy_medicine' ? action.prescriptionDataUrls : [],
        seniorIdDataUrl: action.serviceType === 'buy_medicine' ? action.seniorIdDataUrl : null,
        otherDocDataUrl: action.serviceType === 'buy_medicine' ? action.otherDocDataUrl : null,
        paymentProofDataUrl: action.paymentProofDataUrl,
        bookedByParentId: action.bookedByParentId,
        specialPickupRequested: action.specialPickupRequested,
        specialPickupFee,
        tipOffer: 0,
        paymentAcknowledged: false,
      }
      return { ...state, rides: [ride, ...state.rides] }
    }
    case 'ACCEPT_RIDE': {
      const driver = state.drivers.find((d) => d.id === action.driverId)
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? {
                ...r,
                status: 'driver_arriving',
                driverId: action.driverId,
                driverName: driver?.name ?? 'Driver',
                acceptedAt: new Date().toISOString(),
                driverPosition: DRIVER_BASE_COORDS,
                passengerPosition: r.pickup.coords,
                legProgress: 0,
              }
            : r,
        ),
        // Accepting a ride takes the driver off the terminal queue — busy
        // driving, not waiting in line — until COMPLETE_RIDE puts them
        // back at the end of the line.
        drivers: state.drivers.map((d) => (d.id === action.driverId ? { ...d, queueJoinedAt: null } : d)),
      }
    }
    case 'DECLINE_RIDE':
      // Only the driver currently "up" for this ride can decline it — this
      // is a queue skip (offer passes to the next driver in line), not a
      // whole-ride cancellation.
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId && r.priorityQueueOfferedDriverId === action.driverId
            ? skipCurrentOffer(
                r,
                state.drivers,
                'declined',
                findFavoriteDriverId(state, r.passengerId),
              )
            : r,
        ),
      }
    case 'START_RIDE':
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? {
                ...r,
                status: 'ongoing',
                startedAt: new Date().toISOString(),
                driverPosition: r.pickup.coords,
                passengerPosition: null,
                legProgress: 0,
                routeAlert: false,
                deviationOffset: null,
              }
            : r,
        ),
      }
    case 'COMPLETE_RIDE': {
      // For cash rides, the driver already confirmed receipt in the UI
      // before this fires (see ActiveTripCard); e-wallet/card rides settle
      // automatically. Either way, by the time this action reaches the
      // reducer the fare is considered paid.
      const ride = state.rides.find((r) => r.id === action.rideId)
      if (!ride) return state
      const drivingDriver = state.drivers.find((d) => d.id === ride.driverId)
      const drivingDriverToda = drivingDriver?.todaOrgId
        ? state.todaOrganizations.find((o) => o.id === drivingDriver.todaOrgId)
        : null
      // Platform fee and TODA commission only ever apply to the base fare —
      // a tip is the passenger's to give and goes to the driver in full.
      const platformFee = Math.min(ride.fareEstimate, state.commissionPerRide)
      const todaCommission = Math.min(
        Math.max(0, ride.fareEstimate - platformFee),
        getActiveTodaCommission(drivingDriverToda),
      )
      const totalTip = ride.pabiliTip + (ride.tipOffer || 0)
      const driverPayout = Math.max(0, ride.fareEstimate - platformFee - todaCommission) + totalTip
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? {
                ...r,
                status: 'completed',
                completedAt: new Date().toISOString(),
                payment: {
                  method: r.paymentMethod,
                  status: 'paid',
                  referenceNo: r.paymentMethod === 'cash' ? null : generateReferenceNo(),
                  amount: r.fareEstimate + totalTip,
                  driverPayout,
                  platformFee,
                  todaCommission,
                  tip: totalTip,
                  paidAt: new Date().toISOString(),
                },
              }
            : r,
        ),
        // Driver returns to the back of their TODA's terminal queue after
        // dropping off the passenger — the same "go to the end of the
        // line" rule as any real terminal. No-op for freelancers.
        drivers: state.drivers.map((d) =>
          d.id === ride.driverId && d.todaOrgId !== null ? { ...d, queueJoinedAt: new Date().toISOString() } : d,
        ),
      }
    }
    case 'CANCEL_RIDE':
      return {
        ...state,
        rides: state.rides.map((r) => (r.id === action.rideId ? { ...r, status: 'cancelled' } : r)),
      }
    case 'ADD_TIP_OFFER':
      if (action.amount <= 0) return state
      return {
        ...state,
        // Only meaningful while still waiting for a driver — a no-op once
        // one's already been offered/accepted, so a stale UI click can't
        // retroactively sweeten an already-settled ride.
        rides: state.rides.map((r) =>
          r.id === action.rideId && r.status === 'requested'
            ? { ...r, tipOffer: (r.tipOffer || 0) + action.amount }
            : r,
        ),
      }
    case 'ACKNOWLEDGE_RIDE_PAYMENT':
      // Only meaningful once the trip has actually ended — the payment
      // method stays locked in while a ride is still requested/en
      // route/ongoing (see TripMonitor's disabled buttons), so this is a
      // no-op against a stale click on a ride that isn't 'completed' yet.
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId && r.status === 'completed'
            ? {
                ...r,
                paymentMethod: action.method,
                payment: r.payment ? { ...r.payment, method: action.method } : r.payment,
                paymentAcknowledged: true,
              }
            : r,
        ),
      }
    case 'TICK_POSITIONS': {
      let changed = false
      const newAlerts: SosAlert[] = []
      const rides = state.rides.map((r) => {
        const isDriverMoving = (r.status === 'driver_arriving' || r.status === 'ongoing') && r.legProgress < 1
        // Passenger's simulated phone GPS keeps wobbling while they wait to
        // be picked up, even after the driver's own leg progress hits 100%
        // (arrived but trip not started yet).
        const isPassengerWaiting = r.status === 'driver_arriving' && r.passengerPosition
        // The driver currently up in the terminal queue didn't respond in
        // time — treat it the same as an explicit decline and pass the
        // offer to the next driver in line.
        const isQueueOfferStale =
          r.status === 'requested' &&
          r.priorityQueueOfferedDriverId !== null &&
          r.priorityQueueOfferedAt !== null &&
          Date.now() - new Date(r.priorityQueueOfferedAt).getTime() >= QUEUE_OFFER_TIMEOUT_MS
        if (!isDriverMoving && !isPassengerWaiting && !isQueueOfferStale) return r
        changed = true

        let next = r

        if (isQueueOfferStale) {
          next = skipCurrentOffer(
            next,
            state.drivers,
            'timeout',
            findFavoriteDriverId(state, r.passengerId),
          )
        }

        if (isDriverMoving) {
          const nextProgress = Math.min(1, r.legProgress + PROGRESS_PER_TICK)

          let deviationOffset = r.deviationOffset
          let routeAlert = r.routeAlert
          if (r.status === 'ongoing' && r.isStudentRide && !routeAlert && Math.random() < DEVIATION_CHANCE_PER_TICK) {
            deviationOffset = randomOffset()
            routeAlert = true
            newAlerts.push(
              makeAlert(
                r.id,
                r.passengerId,
                'route_deviation',
                `${r.passengerName}'s trip drifted off the expected route between ${r.pickup.label} and ${r.dropoff.label}.`,
              ),
            )
          }

          const basePosition = lerp(legOrigin(r), legDestination(r), nextProgress)
          const position = deviationOffset
            ? { x: clampToMap(basePosition.x + deviationOffset.x), y: clampToMap(basePosition.y + deviationOffset.y) }
            : basePosition
          const ping = { ts: new Date().toISOString(), coords: position }
          next = {
            ...next,
            legProgress: nextProgress,
            driverPosition: position,
            locationLog: [...next.locationLog, ping].slice(-MAX_LOG_ENTRIES),
            routeAlert,
            deviationOffset,
          }
        }

        if (isPassengerWaiting && next.passengerPosition) {
          next = {
            ...next,
            passengerPosition: {
              x: clampToMap(next.passengerPosition.x + (Math.random() - 0.5) * 2 * PASSENGER_JITTER_STEP),
              y: clampToMap(next.passengerPosition.y + (Math.random() - 0.5) * 2 * PASSENGER_JITTER_STEP),
            },
          }
        }

        return next
      })
      // Also re-render while any ride is still waiting on a driver, so the
      // TODA-priority countdown ("opens to others in Xs") ticks down live
      // even when nothing else in the app is animating right now.
      const hasWaitingRides = state.rides.some((r) => r.status === 'requested')
      if (!changed && !hasWaitingRides) return state
      return { ...state, rides, alerts: newAlerts.length ? [...newAlerts, ...state.alerts] : state.alerts }
    }
    case 'UPDATE_DRIVER_LIVE_GPS':
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? { ...r, driverLiveGps: action.gps, driverLiveGpsAt: action.gps ? new Date().toISOString() : null }
            : r,
        ),
      }
    case 'UPDATE_PASSENGER_LIVE_GPS':
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? { ...r, passengerLiveGps: action.gps, passengerLiveGpsAt: action.gps ? new Date().toISOString() : null }
            : r,
        ),
      }
    case 'TRIGGER_SOS': {
      const ride = state.rides.find((r) => r.id === action.rideId)
      if (!ride) return state
      // No linked parent account to alert in-app? Fall back to whatever
      // guardian/emergency contact number this passenger registered.
      const hasLinkedParent = state.parentLinks.some((l) => l.studentPassengerId === ride.passengerId)
      const passenger = state.passengers.find((p) => p.id === ride.passengerId)
      const guardianPhone = !hasLinkedParent ? (passenger?.guardianPhone ?? null) : null
      const notes = guardianPhone
        ? `SOS triggered on ${ride.passengerName}'s trip (${ride.pickup.label} → ${ride.dropoff.label}). No parent account linked — emergency contact notified at ${guardianPhone}.`
        : `SOS triggered on ${ride.passengerName}'s trip (${ride.pickup.label} → ${ride.dropoff.label}).`
      const alert = makeAlert(action.rideId, action.triggeredBy, 'sos', notes, guardianPhone)
      return { ...state, alerts: [alert, ...state.alerts] }
    }
    case 'TRIGGER_DRIVER_SOS': {
      const driver = state.drivers.find((d) => d.id === action.driverId)
      if (!driver) return state
      const notes = action.notes?.trim() || `${driver.name} (${driver.plateNumber}) triggered an emergency SOS.`
      const alert: SosAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rideId: null,
        triggeredBy: action.driverId,
        type: 'sos',
        status: 'open',
        notes,
        createdAt: new Date().toISOString(),
        guardianNotifiedPhone: null,
        triggeredByRole: 'driver',
        todaOrgId: driver.todaOrgId,
        location: action.location,
      }
      return { ...state, alerts: [alert, ...state.alerts] }
    }
    case 'RESOLVE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((a) => (a.id === action.alertId ? { ...a, status: 'resolved' } : a)),
      }
    case 'APPROVE_DRIVER':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId
            ? { ...d, verificationStatus: 'approved', online: true, rejectionReason: null, appealMessage: null, appealedAt: null }
            : d,
        ),
      }
    case 'REJECT_DRIVER':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId
            ? {
                ...d,
                verificationStatus: 'rejected',
                online: false,
                rejectionReason: action.reason,
                appealMessage: null,
                appealedAt: null,
              }
            : d,
        ),
      }
    case 'APPEAL_DRIVER_REJECTION':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId
            ? {
                ...d,
                verificationStatus: 'pending',
                appealMessage: action.message,
                appealedAt: new Date().toISOString(),
                pendingNote: null,
                pendingNoteDeadline: null,
              }
            : d,
        ),
      }
    // A pending applicant re-uploading a document (following up on Admin's
    // "approve as noted" requirements) clears the old note/deadline — the
    // specific thing Admin flagged has just been addressed, so this goes
    // back to a plain "under review" state instead of still showing a stale
    // complaint/clock alongside the freshly-replaced file.
    case 'RESUBMIT_DRIVER_DOCUMENT':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId && d.verificationStatus === 'pending'
            ? {
                ...d,
                documents: {
                  ...d.documents,
                  [action.docType]: { submitted: true, dataUrl: action.dataUrl },
                },
                pendingNote: null,
                pendingNoteDeadline: null,
              }
            : d,
        ),
      }
    case 'HYDRATE':
      return action.state
    case 'SET_COMMISSION':
      return { ...state, commissionPerRide: Math.max(0, action.amount) }
    case 'JOIN_TERMINAL_QUEUE': {
      const joiningDriver = state.drivers.find((d) => d.id === action.driverId)
      const joiningOrg = joiningDriver?.todaOrgId
        ? state.todaOrganizations.find((o) => o.id === joiningDriver.todaOrgId)
        : null
      // If the org has a registered terminal GPS, the driver must actually
      // be there (within TERMINAL_PROXIMITY_METERS) to join — the UI is
      // responsible for capturing driverGps via the real Geolocation API
      // before dispatching this; this check is defense-in-depth so nothing
      // can bypass it by dispatching without a valid position.
      const withinRange =
        !joiningOrg?.terminalGps ||
        (action.driverGps && haversineDistanceMeters(action.driverGps, joiningOrg.terminalGps) <= TERMINAL_PROXIMITY_METERS)
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId &&
          d.todaOrgId !== null &&
          d.queueJoinedAt === null &&
          d.accessStatus === 'active' &&
          withinRange
            ? { ...d, queueJoinedAt: new Date().toISOString() }
            : d,
        ),
      }
    }
    case 'LEAVE_TERMINAL_QUEUE':
      return {
        ...state,
        drivers: state.drivers.map((d) => (d.id === action.driverId ? { ...d, queueJoinedAt: null } : d)),
      }
    case 'SET_TODA_QUEUE_WINDOW':
      return { ...state, todaQueueWindowMs: Math.max(5000, action.ms) }
    case 'SET_SPECIAL_PICKUP_ESCALATION_MS':
      return { ...state, specialPickupEscalationMs: Math.max(5000, action.ms) }
    case 'SET_FAVORITE_DRIVER':
      return {
        ...state,
        passengers: state.passengers.map((p) =>
          p.id === action.passengerId ? { ...p, favoriteDriverId: action.driverId } : p,
        ),
      }
    case 'SET_PARENT_FAVORITE_DRIVER':
      return {
        ...state,
        parents: state.parents.map((p) => (p.id === action.parentId ? { ...p, favoriteDriverId: action.driverId } : p)),
      }
    case 'PROPOSE_TODA_COMMISSION':
      // A new proposal resets both sign-offs — a changed rate needs fresh
      // approval, not a rubber-stamp of whatever was approved before.
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId
            ? {
                ...o,
                proposedCommissionPerRide: action.amount === null ? null : Math.max(0, action.amount),
                commissionApprovedByMembers: false,
                commissionApprovedByAdmin: false,
              }
            : o,
        ),
      }
    case 'SET_TODA_COMMISSION_MEMBER_APPROVAL':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId ? { ...o, commissionApprovedByMembers: action.approved } : o,
        ),
      }
    case 'SET_TODA_COMMISSION_ADMIN_APPROVAL':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId ? { ...o, commissionApprovedByAdmin: action.approved } : o,
        ),
      }
    case 'ADD_DUES_RECORD': {
      const records: DuesRecord[] = action.driverIds.map((driverId, i) => ({
        id: `dues-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        driverId,
        todaOrgId: action.todaOrgId,
        type: action.duesType,
        label: action.label,
        amount: action.amount,
        dueDate: action.dueDate,
        paidAt: null,
      }))
      return { ...state, duesRecords: [...records, ...state.duesRecords] }
    }
    case 'MARK_DUES_PAID':
      return {
        ...state,
        duesRecords: state.duesRecords.map((d) =>
          d.id === action.duesRecordId ? { ...d, paidAt: new Date().toISOString() } : d,
        ),
      }
    case 'REQUEST_MEMBERSHIP_ACTION': {
      const request: MembershipRequest = {
        id: `mreq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        driverId: action.driverId,
        todaOrgId: action.todaOrgId,
        requestType: action.requestType,
        reason: action.reason,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
      }
      return { ...state, membershipRequests: [request, ...state.membershipRequests] }
    }
    case 'RESOLVE_MEMBERSHIP_REQUEST': {
      const request = state.membershipRequests.find((r) => r.id === action.requestId)
      if (!request || request.status !== 'pending') return state
      const nextDrivers = action.approve
        ? state.drivers.map((d) =>
            d.id === request.driverId
              ? {
                  ...d,
                  accessStatus: (request.requestType === 'terminate' ? 'terminated' : 'paused') as DriverAccessStatus,
                  accessNote: `${request.requestType === 'terminate' ? 'Terminated' : 'Held'} at the request of your TODA: ${request.reason}`,
                  queueJoinedAt: null,
                }
              : d,
          )
        : state.drivers
      return {
        ...state,
        drivers: nextDrivers,
        membershipRequests: state.membershipRequests.map((r) =>
          r.id === action.requestId
            ? { ...r, status: action.approve ? 'approved' : 'rejected', resolvedAt: new Date().toISOString() }
            : r,
        ),
      }
    }
    case 'SET_DRIVER_ACCESS':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId
            ? {
                ...d,
                accessStatus: action.accessStatus,
                accessNote: action.accessNote,
                queueJoinedAt: action.accessStatus === 'active' ? d.queueJoinedAt : null,
              }
            : d,
        ),
      }
    case 'SET_DRIVER_PABILI_PRIORITY':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId ? { ...d, pabiliPriority: action.enabled } : d,
        ),
      }
    case 'SET_DRIVER_ONLINE':
      return {
        ...state,
        drivers: state.drivers.map((d) => (d.id === action.driverId ? { ...d, online: action.online } : d)),
      }
    case 'UPDATE_PASSENGER_PROFILE':
      return {
        ...state,
        passengers: state.passengers.map((p) =>
          p.id === action.passengerId
            ? {
                ...p,
                name: action.name,
                phone: action.phone,
                email: action.email,
                pin: action.pin,
                paymentDetail: action.paymentDetail,
                password: action.password,
                guardianPhone: action.guardianPhone,
              }
            : p,
        ),
      }
    case 'UPDATE_DRIVER_PROFILE':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId
            ? {
                ...d,
                name: action.name,
                phone: action.phone,
                email: action.email,
                pin: action.pin,
                paymentDetail: action.paymentDetail,
                password: action.password,
                emergencyContact: action.emergencyContact,
              }
            : d,
        ),
      }
    case 'UPDATE_PARENT_PROFILE':
      return {
        ...state,
        parents: state.parents.map((p) =>
          p.id === action.parentId
            ? {
                ...p,
                name: action.name,
                phone: action.phone,
                email: action.email,
                pin: action.pin,
                paymentDetail: action.paymentDetail,
                password: action.password,
                emergencyContact: action.emergencyContact,
              }
            : p,
        ),
      }
    case 'UPDATE_PHARMACY_PROFILE':
      return {
        ...state,
        pharmacies: state.pharmacies.map((p) =>
          p.id === action.pharmacyId
            ? {
                ...p,
                name: action.name,
                contactPhone: action.phone,
                email: action.email,
                adminPin: action.pin,
                paymentDetail: action.paymentDetail,
                password: action.password,
                emergencyContact: action.emergencyContact,
              }
            : p,
        ),
      }
    case 'SET_DUES_GRACE_PERIOD_DAYS':
      return { ...state, duesGracePeriodDays: Math.max(1, action.days) }
    case 'SET_TRIP_HISTORY_RETENTION_DAYS':
      return { ...state, tripHistoryRetentionDays: Math.max(1, action.days) }
    case 'SET_DRIVER_PENDING_NOTE':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === action.driverId ? { ...d, pendingNote: action.note, pendingNoteDeadline: action.deadline } : d,
        ),
      }
    case 'REGISTER_TODA_ORGANIZATION': {
      const org: TodaOrganization = {
        id: action.id,
        name: action.name,
        terminalLocationId: null,
        proposedCommissionPerRide: null,
        commissionApprovedByMembers: false,
        commissionApprovedByAdmin: false,
        adminPin: action.adminPin,
        officers: action.officers,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        terminalGps: action.terminalGps,
        verificationStatus: 'pending',
        registrationNote: null,
        registrationNoteDeadline: null,
        rating: 0,
        ratingCount: 0,
        // New self-registered TODAs start as Level-1 SaaS Partners on the
        // cheapest tier, reporting directly to HQ — matches the roadmap's
        // "earn the right to franchise" progression.
        saasPlan: 'starter',
        monthlyPlatformFee: SAAS_PLAN_FEES.starter,
        perBookingFee: 0,
        operatorId: null,
      }
      return { ...state, todaOrganizations: [...state.todaOrganizations, org] }
    }
    case 'APPROVE_TODA_ORG':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId ? { ...o, verificationStatus: 'approved' } : o,
        ),
      }
    case 'REJECT_TODA_ORG':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId ? { ...o, verificationStatus: 'rejected' } : o,
        ),
      }
    case 'SET_TODA_ORG_PENDING_NOTE':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId
            ? { ...o, registrationNote: action.note, registrationNoteDeadline: action.deadline }
            : o,
        ),
      }
    case 'SET_TODA_SAAS_PLAN':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId
            ? { ...o, saasPlan: action.plan, monthlyPlatformFee: SAAS_PLAN_FEES[action.plan], perBookingFee: action.perBookingFee }
            : o,
        ),
      }
    case 'SET_TODA_OPERATOR':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId ? { ...o, operatorId: action.operatorId } : o,
        ),
      }
    case 'REGISTER_OPERATOR': {
      const operator: Operator = {
        id: action.id,
        name: action.name,
        contactPerson: action.contactPerson,
        contactPhone: action.contactPhone,
        adminPin: action.adminPin,
        province: action.province,
        city: action.city,
        email: null,
        barangay: '',
        addressDetail: '',
        businessRegistrationNo: null,
        activationFee: null,
        monthlyPlatformFee: 0,
        perBookingFee: 0,
        franchiseId: null,
        verificationStatus: 'pending',
        registrationNote: null,
      }
      return { ...state, operators: [...state.operators, operator] }
    }
    case 'UPDATE_OPERATOR_PROFILE':
      return {
        ...state,
        operators: state.operators.map((o) =>
          o.id === action.operatorId
            ? {
                ...o,
                contactPerson: action.contactPerson,
                contactPhone: action.contactPhone,
                email: action.email,
                province: action.province,
                city: action.city,
                barangay: action.barangay,
                addressDetail: action.addressDetail,
                businessRegistrationNo: action.businessRegistrationNo,
              }
            : o,
        ),
      }
    case 'APPROVE_OPERATOR':
      return {
        ...state,
        operators: state.operators.map((o) =>
          o.id === action.operatorId ? { ...o, verificationStatus: 'approved' } : o,
        ),
      }
    case 'REJECT_OPERATOR':
      return {
        ...state,
        operators: state.operators.map((o) =>
          o.id === action.operatorId ? { ...o, verificationStatus: 'rejected' } : o,
        ),
      }
    case 'SET_OPERATOR_FEES':
      return {
        ...state,
        operators: state.operators.map((o) =>
          o.id === action.operatorId
            ? {
                ...o,
                activationFee: action.activationFee,
                monthlyPlatformFee: action.monthlyPlatformFee,
                perBookingFee: action.perBookingFee,
              }
            : o,
        ),
      }
    case 'SET_OPERATOR_FRANCHISE':
      return {
        ...state,
        operators: state.operators.map((o) =>
          o.id === action.operatorId ? { ...o, franchiseId: action.franchiseId } : o,
        ),
      }
    case 'REGISTER_FRANCHISE': {
      const franchise: Franchise = {
        id: action.id,
        name: action.name,
        contactPerson: action.contactPerson,
        contactPhone: action.contactPhone,
        adminPin: action.adminPin,
        province: action.province,
        city: action.city,
        email: null,
        barangay: '',
        addressDetail: '',
        businessRegistrationNo: null,
        initialFranchiseFee: null,
        monthlyTechnologyFee: 0,
        royaltyPct: null,
        verificationStatus: 'pending',
        registrationNote: null,
      }
      return { ...state, franchises: [...state.franchises, franchise] }
    }
    case 'UPDATE_FRANCHISE_PROFILE':
      return {
        ...state,
        franchises: state.franchises.map((f) =>
          f.id === action.franchiseId
            ? {
                ...f,
                contactPerson: action.contactPerson,
                contactPhone: action.contactPhone,
                email: action.email,
                province: action.province,
                city: action.city,
                barangay: action.barangay,
                addressDetail: action.addressDetail,
                businessRegistrationNo: action.businessRegistrationNo,
              }
            : f,
        ),
      }
    case 'APPROVE_FRANCHISE':
      return {
        ...state,
        franchises: state.franchises.map((f) =>
          f.id === action.franchiseId ? { ...f, verificationStatus: 'approved' } : f,
        ),
      }
    case 'REJECT_FRANCHISE':
      return {
        ...state,
        franchises: state.franchises.map((f) =>
          f.id === action.franchiseId ? { ...f, verificationStatus: 'rejected' } : f,
        ),
      }
    case 'SET_FRANCHISE_FEES':
      return {
        ...state,
        franchises: state.franchises.map((f) =>
          f.id === action.franchiseId
            ? {
                ...f,
                initialFranchiseFee: action.initialFranchiseFee,
                monthlyTechnologyFee: action.monthlyTechnologyFee,
                royaltyPct: action.royaltyPct,
              }
            : f,
        ),
      }
    case 'SET_TODA_TERMINAL_GPS':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId ? { ...o, terminalGps: action.gps } : o,
        ),
      }
    case 'SET_TODA_TERMINAL_ADDRESS':
      return {
        ...state,
        todaOrganizations: state.todaOrganizations.map((o) =>
          o.id === action.todaOrgId
            ? {
                ...o,
                province: action.province,
                city: action.city,
                barangay: action.barangay,
                addressDetail: action.addressDetail,
              }
            : o,
        ),
      }
    case 'SET_TARIFF_SETTINGS':
      return { ...state, tariffSettings: action.settings }
    case 'SET_PABILI_SERVICE_FEE':
      return { ...state, pabiliServiceFee: Math.max(0, action.amount) }
    case 'ADD_EXPENSE': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      const expense: ExpenseRecord = {
        id: action.id,
        category: action.category,
        amount: action.amount,
        description: action.description,
        recordedAt: new Date().toISOString(),
        recordedBy: action.recordedBy,
      }
      return { ...state, expenses: [expense, ...state.expenses] }
    }
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.expenseId) }
    case 'TOGGLE_COMPLIANCE_ITEM':
      return {
        ...state,
        complianceChecked: { ...state.complianceChecked, [action.itemId]: action.done },
      }
    case 'SET_COMPLIANCE_NOTE':
      return {
        ...state,
        complianceReview: {
          ...state.complianceReview,
          [action.itemId]: { note: action.note, deadlineAt: action.deadlineAt },
        },
      }
    case 'ADD_CAPITAL_CONTRIBUTION': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      if (!Number.isFinite(action.shares) || action.shares <= 0) return state
      const contribution: CapitalContribution = {
        id: action.id,
        stockholderName: action.stockholderName,
        shares: action.shares,
        amount: action.amount,
        contributedAt: new Date().toISOString(),
        recordedBy: action.recordedBy,
      }
      return { ...state, capitalContributions: [contribution, ...state.capitalContributions] }
    }
    case 'DELETE_CAPITAL_CONTRIBUTION':
      return {
        ...state,
        capitalContributions: state.capitalContributions.filter((c) => c.id !== action.contributionId),
      }
    case 'ADD_ACCOUNTING_OFFICER': {
      if (!action.name.trim() || !action.email.trim()) return state
      const officer: AccountingOfficer = {
        id: action.id,
        name: action.name.trim(),
        email: action.email.trim().toLowerCase(),
        position: action.position,
        otherPositionLabel: action.position === 'Other' ? action.otherPositionLabel : null,
        addedAt: new Date().toISOString(),
      }
      return { ...state, accountingOfficers: [officer, ...state.accountingOfficers] }
    }
    case 'REMOVE_ACCOUNTING_OFFICER':
      return {
        ...state,
        accountingOfficers: state.accountingOfficers.filter((o) => o.id !== action.officerId),
      }
    case 'UPDATE_ACCOUNTING_OFFICER': {
      if (!action.name.trim() || !action.email.trim()) return state
      return {
        ...state,
        accountingOfficers: state.accountingOfficers.map((o) =>
          o.id === action.officerId
            ? {
                ...o,
                name: action.name.trim(),
                email: action.email.trim().toLowerCase(),
                position: action.position,
                otherPositionLabel: action.position === 'Other' ? action.otherPositionLabel : null,
              }
            : o,
        ),
      }
    }
    case 'ADD_EQUITY_ALLOCATION': {
      if (!action.holderName.trim() || !Number.isFinite(action.percentage) || action.percentage <= 0) return state
      const allocation: EquityAllocation = {
        id: action.id,
        holderName: action.holderName.trim(),
        category: action.category,
        otherCategoryLabel: action.category === 'Other' ? action.otherCategoryLabel : null,
        percentage: action.percentage,
        notes: action.notes,
        addedAt: new Date().toISOString(),
      }
      return { ...state, equityAllocations: [allocation, ...state.equityAllocations] }
    }
    case 'UPDATE_EQUITY_ALLOCATION': {
      if (!action.holderName.trim() || !Number.isFinite(action.percentage) || action.percentage <= 0) return state
      return {
        ...state,
        equityAllocations: state.equityAllocations.map((a) =>
          a.id === action.allocationId
            ? {
                ...a,
                holderName: action.holderName.trim(),
                category: action.category,
                otherCategoryLabel: action.category === 'Other' ? action.otherCategoryLabel : null,
                percentage: action.percentage,
                notes: action.notes,
              }
            : a,
        ),
      }
    }
    case 'REMOVE_EQUITY_ALLOCATION':
      return {
        ...state,
        equityAllocations: state.equityAllocations.filter((a) => a.id !== action.allocationId),
      }
    case 'ADD_INVESTOR': {
      if (!action.investorName.trim() || !Number.isFinite(action.investmentAmount) || action.investmentAmount <= 0)
        return state
      const investor: Investor = {
        id: action.id,
        investorName: action.investorName.trim(),
        investmentDate: action.investmentDate,
        investmentAmount: action.investmentAmount,
        investmentRound: action.investmentRound.trim(),
        preMoneyValuation: action.preMoneyValuation,
        postMoneyValuation: action.postMoneyValuation,
        sharePercentage: action.sharePercentage,
        shareClass: action.shareClass,
        agreementReference: action.agreementReference,
        status: action.status,
        notes: action.notes,
        addedAt: new Date().toISOString(),
      }
      return { ...state, investors: [investor, ...state.investors] }
    }
    case 'UPDATE_INVESTOR': {
      if (!action.investorName.trim() || !Number.isFinite(action.investmentAmount) || action.investmentAmount <= 0)
        return state
      return {
        ...state,
        investors: state.investors.map((inv) =>
          inv.id === action.investorId
            ? {
                ...inv,
                investorName: action.investorName.trim(),
                investmentDate: action.investmentDate,
                investmentAmount: action.investmentAmount,
                investmentRound: action.investmentRound.trim(),
                preMoneyValuation: action.preMoneyValuation,
                postMoneyValuation: action.postMoneyValuation,
                sharePercentage: action.sharePercentage,
                shareClass: action.shareClass,
                agreementReference: action.agreementReference,
                status: action.status,
                notes: action.notes,
              }
            : inv,
        ),
      }
    }
    case 'REMOVE_INVESTOR':
      return { ...state, investors: state.investors.filter((inv) => inv.id !== action.investorId) }
    case 'ADD_FOUNDER_CONTRIBUTION': {
      if (!action.founderName.trim() || !action.description.trim() || !Number.isFinite(action.estimatedValue) || action.estimatedValue <= 0)
        return state
      const contribution: FounderContribution = {
        id: action.id,
        founderName: action.founderName.trim(),
        date: action.date,
        contributionType: action.contributionType.trim(),
        description: action.description.trim(),
        kind: action.kind,
        estimatedValue: action.estimatedValue,
        supportingDocDataUrl: action.supportingDocDataUrl,
        status: 'pending',
        approvedValue: null,
        approvedBy: null,
        approvalDate: null,
        addedAt: new Date().toISOString(),
      }
      return { ...state, founderContributions: [contribution, ...state.founderContributions] }
    }
    case 'UPDATE_FOUNDER_CONTRIBUTION': {
      if (!action.founderName.trim() || !action.description.trim() || !Number.isFinite(action.estimatedValue) || action.estimatedValue <= 0)
        return state
      return {
        ...state,
        founderContributions: state.founderContributions.map((c) =>
          c.id === action.contributionId
            ? {
                ...c,
                founderName: action.founderName.trim(),
                date: action.date,
                contributionType: action.contributionType.trim(),
                description: action.description.trim(),
                kind: action.kind,
                estimatedValue: action.estimatedValue,
                supportingDocDataUrl: action.supportingDocDataUrl,
              }
            : c,
        ),
      }
    }
    case 'SET_FOUNDER_CONTRIBUTION_STATUS':
      return {
        ...state,
        founderContributions: state.founderContributions.map((c) =>
          c.id === action.contributionId
            ? {
                ...c,
                status: action.status,
                approvedValue: action.status === 'approved' ? action.approvedValue : null,
                approvedBy: action.status === 'pending' ? null : action.approvedBy,
                approvalDate: action.status === 'pending' ? null : new Date().toISOString(),
              }
            : c,
        ),
      }
    case 'REMOVE_FOUNDER_CONTRIBUTION':
      return {
        ...state,
        founderContributions: state.founderContributions.filter((c) => c.id !== action.contributionId),
      }
    case 'SET_SOCIAL_IMPACT_FUND_PCT':
      return { ...state, socialImpactFundPct: Math.max(0, Math.min(100, action.pct)) }
    case 'ADD_SOCIAL_IMPACT_TRANSACTION': {
      if (!action.description.trim() || !Number.isFinite(action.amount) || action.amount <= 0) return state
      const transaction: SocialImpactTransaction = {
        id: action.id,
        date: action.date,
        description: action.description.trim(),
        amount: action.amount,
        projectId: action.projectId,
        category: action.category,
        status: action.status,
        approvedBy: action.approvedBy,
        supportingDocDataUrl: action.supportingDocDataUrl,
        addedAt: new Date().toISOString(),
      }
      return { ...state, socialImpactTransactions: [transaction, ...state.socialImpactTransactions] }
    }
    case 'SET_SOCIAL_IMPACT_TRANSACTION_STATUS':
      return {
        ...state,
        socialImpactTransactions: state.socialImpactTransactions.map((t) =>
          t.id === action.transactionId ? { ...t, status: action.status, approvedBy: action.approvedBy } : t,
        ),
      }
    case 'REMOVE_SOCIAL_IMPACT_TRANSACTION':
      return {
        ...state,
        socialImpactTransactions: state.socialImpactTransactions.filter((t) => t.id !== action.transactionId),
      }
    case 'ADD_ROTARY_PROJECT': {
      if (!action.projectName.trim()) return state
      const project: RotaryProject = {
        id: action.id,
        projectName: action.projectName.trim(),
        partner: action.partner.trim(),
        description: action.description.trim(),
        category: action.category,
        approvedBudget: action.approvedBudget,
        socialImpactFundAllocation: action.socialImpactFundAllocation,
        additionalFunding: action.additionalFunding,
        status: action.status,
        startDate: action.startDate,
        endDate: action.endDate,
        addedAt: new Date().toISOString(),
      }
      return { ...state, rotaryProjects: [project, ...state.rotaryProjects] }
    }
    case 'UPDATE_ROTARY_PROJECT': {
      if (!action.projectName.trim()) return state
      return {
        ...state,
        rotaryProjects: state.rotaryProjects.map((p) =>
          p.id === action.projectId
            ? {
                ...p,
                projectName: action.projectName.trim(),
                partner: action.partner.trim(),
                description: action.description.trim(),
                category: action.category,
                approvedBudget: action.approvedBudget,
                socialImpactFundAllocation: action.socialImpactFundAllocation,
                additionalFunding: action.additionalFunding,
                status: action.status,
                startDate: action.startDate,
                endDate: action.endDate,
              }
            : p,
        ),
      }
    }
    case 'REMOVE_ROTARY_PROJECT':
      return { ...state, rotaryProjects: state.rotaryProjects.filter((p) => p.id !== action.projectId) }
    case 'ADD_DISTRIBUTION': {
      if (!action.recipient.trim() || !Number.isFinite(action.amount) || action.amount <= 0) return state
      const distribution: Distribution = {
        id: action.id,
        recipient: action.recipient.trim(),
        distributionType: action.distributionType,
        amount: action.amount,
        date: action.date,
        source: action.source.trim(),
        reference: action.reference,
        status: action.status,
        approvedBy: action.approvedBy,
        addedAt: new Date().toISOString(),
      }
      return { ...state, distributions: [distribution, ...state.distributions] }
    }
    case 'UPDATE_DISTRIBUTION': {
      if (!action.recipient.trim() || !Number.isFinite(action.amount) || action.amount <= 0) return state
      return {
        ...state,
        distributions: state.distributions.map((d) =>
          d.id === action.distributionId
            ? {
                ...d,
                recipient: action.recipient.trim(),
                distributionType: action.distributionType,
                amount: action.amount,
                date: action.date,
                source: action.source.trim(),
                reference: action.reference,
                status: action.status,
                approvedBy: action.approvedBy,
              }
            : d,
        ),
      }
    }
    case 'REMOVE_DISTRIBUTION':
      return { ...state, distributions: state.distributions.filter((d) => d.id !== action.distributionId) }
    case 'ADD_RCC_INCENTIVE': {
      if (!action.description.trim() || !Number.isFinite(action.amount) || action.amount <= 0) return state
      const incentive: RccIncentive = {
        id: action.id,
        partner: action.partner.trim(),
        basis: action.basis,
        description: action.description.trim(),
        amount: action.amount,
        date: action.date,
        status: action.status,
        approvedBy: action.approvedBy,
        addedAt: new Date().toISOString(),
      }
      return { ...state, rccIncentives: [incentive, ...state.rccIncentives] }
    }
    case 'UPDATE_RCC_INCENTIVE': {
      if (!action.description.trim() || !Number.isFinite(action.amount) || action.amount <= 0) return state
      return {
        ...state,
        rccIncentives: state.rccIncentives.map((r) =>
          r.id === action.incentiveId
            ? {
                ...r,
                partner: action.partner.trim(),
                basis: action.basis,
                description: action.description.trim(),
                amount: action.amount,
                date: action.date,
                status: action.status,
                approvedBy: action.approvedBy,
              }
            : r,
        ),
      }
    }
    case 'REMOVE_RCC_INCENTIVE':
      return { ...state, rccIncentives: state.rccIncentives.filter((r) => r.id !== action.incentiveId) }
    case 'UPDATE_CORPORATE_REGISTRATION':
      return { ...state, corporateRegistration: { ...action.info, updatedAt: new Date().toISOString() } }
    case 'ADD_STOCKHOLDER': {
      if (!action.name.trim() || !Number.isFinite(action.sharesSubscribed) || action.sharesSubscribed <= 0) return state
      const stockholder: Stockholder = {
        id: action.id,
        name: action.name.trim(),
        nationality: action.nationality.trim(),
        address: action.address.trim(),
        stockholderType: action.stockholderType,
        sharesSubscribed: action.sharesSubscribed,
        amountSubscribed: action.amountSubscribed,
        amountPaid: action.amountPaid,
        dateSubscribed: action.dateSubscribed,
        certificateNo: action.certificateNo,
        addedAt: new Date().toISOString(),
      }
      return { ...state, stockholders: [stockholder, ...state.stockholders] }
    }
    case 'UPDATE_STOCKHOLDER': {
      if (!action.name.trim() || !Number.isFinite(action.sharesSubscribed) || action.sharesSubscribed <= 0) return state
      return {
        ...state,
        stockholders: state.stockholders.map((s) =>
          s.id === action.stockholderId
            ? {
                ...s,
                name: action.name.trim(),
                nationality: action.nationality.trim(),
                address: action.address.trim(),
                stockholderType: action.stockholderType,
                sharesSubscribed: action.sharesSubscribed,
                amountSubscribed: action.amountSubscribed,
                amountPaid: action.amountPaid,
                dateSubscribed: action.dateSubscribed,
                certificateNo: action.certificateNo,
              }
            : s,
        ),
      }
    }
    case 'REMOVE_STOCKHOLDER':
      return { ...state, stockholders: state.stockholders.filter((s) => s.id !== action.stockholderId) }
    case 'ADD_TODA_CONTRIBUTION': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      const contribution: TodaContribution = {
        id: action.id,
        todaOrgId: action.todaOrgId,
        contributorName: action.contributorName,
        purpose: action.purpose,
        amount: action.amount,
        contributedAt: new Date().toISOString(),
        recordedBy: action.recordedBy,
      }
      return { ...state, todaContributions: [contribution, ...state.todaContributions] }
    }
    case 'DELETE_TODA_CONTRIBUTION':
      return {
        ...state,
        todaContributions: state.todaContributions.filter((c) => c.id !== action.contributionId),
      }
    case 'ADD_TODA_EXPENSE': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      const expense: TodaExpenseRecord = {
        id: action.id,
        todaOrgId: action.todaOrgId,
        category: action.category,
        amount: action.amount,
        description: action.description,
        recordedAt: new Date().toISOString(),
        recordedBy: action.recordedBy,
      }
      return { ...state, todaExpenses: [expense, ...state.todaExpenses] }
    }
    case 'DELETE_TODA_EXPENSE':
      return { ...state, todaExpenses: state.todaExpenses.filter((e) => e.id !== action.expenseId) }
    case 'SAVE_PASSENGER_LOCATION':
      return {
        ...state,
        passengers: state.passengers.map((p) =>
          p.id === action.passengerId
            ? {
                ...p,
                // Home/School/Work are single-slot — saving a new one under
                // that label replaces it. Favorite is the exception: it
                // accumulates (a rider can have many favorite places), so an
                // existing Favorite is never displaced by a new one.
                savedLocations: [
                  ...p.savedLocations.filter((s) => action.label === 'Favorite' || s.label !== action.label),
                  { id: action.id, label: action.label, location: action.location },
                ],
              }
            : p,
        ),
      }
    case 'REMOVE_PASSENGER_LOCATION':
      return {
        ...state,
        passengers: state.passengers.map((p) =>
          p.id === action.passengerId
            ? { ...p, savedLocations: p.savedLocations.filter((s) => s.id !== action.savedLocationId) }
            : p,
        ),
      }
    case 'RATE_RIDE': {
      const ride = state.rides.find((r) => r.id === action.rideId)
      // Only a completed, not-yet-rated ride can be rated — once, not
      // editable, same as most real ride-hailing apps.
      if (!ride || ride.status !== 'completed' || ride.ratedAt || !ride.driverId) return state
      const drivingDriver = state.drivers.find((d) => d.id === ride.driverId)
      const drivingDriverToda = drivingDriver?.todaOrgId
        ? state.todaOrganizations.find((o) => o.id === drivingDriver.todaOrgId)
        : null
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? {
                ...r,
                driverRating: action.driverRating,
                driverReviewText: action.driverReviewText || null,
                todaRating: action.todaRating,
                todaReviewText: action.todaReviewText || null,
                ratedAt: new Date().toISOString(),
              }
            : r,
        ),
        drivers: state.drivers.map((d) =>
          d.id === ride.driverId
            ? {
                ...d,
                rating:
                  Math.round(
                    ((d.rating * d.ratingCount + action.driverRating) / (d.ratingCount + 1)) * 10,
                  ) / 10,
                ratingCount: d.ratingCount + 1,
              }
            : d,
        ),
        todaOrganizations:
          action.todaRating !== null && drivingDriverToda
            ? state.todaOrganizations.map((o) =>
                o.id === drivingDriverToda.id
                  ? {
                      ...o,
                      rating:
                        Math.round(
                          ((o.rating * o.ratingCount + action.todaRating!) / (o.ratingCount + 1)) * 10,
                        ) / 10,
                      ratingCount: o.ratingCount + 1,
                    }
                  : o,
              )
            : state.todaOrganizations,
      }
    }
    case 'REPORT_DRIVER': {
      const report: DriverReport = {
        id: action.id,
        rideId: action.rideId,
        passengerId: action.passengerId,
        passengerName: action.passengerName,
        driverId: action.driverId,
        driverName: action.driverName,
        reason: action.reason,
        details: action.details,
        createdAt: new Date().toISOString(),
        status: 'open',
      }
      return { ...state, driverReports: [report, ...state.driverReports] }
    }
    case 'RESOLVE_DRIVER_REPORT':
      return {
        ...state,
        driverReports: state.driverReports.map((r) =>
          r.id === action.reportId ? { ...r, status: 'reviewed' } : r,
        ),
      }
    case 'ADD_SAFETY_PHOTO': {
      const photo = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl: action.dataUrl,
        takenBy: action.takenBy,
        takenAt: new Date().toISOString(),
      }
      return {
        ...state,
        rides: state.rides.map((r) =>
          r.id === action.rideId
            ? { ...r, safetyPhotos: [...r.safetyPhotos, photo].slice(-MAX_PHOTOS_PER_RIDE) }
            : r,
        ),
      }
    }
    case 'REGISTER_DRIVER': {
      const driver: Driver = {
        id: `drv-${Date.now()}`,
        name: action.name,
        plateNumber: action.plateNumber,
        licenseNo: action.licenseNo,
        licenseExpiry: action.licenseExpiry,
        pin: action.pin,
        rating: 0,
        ratingCount: 0,
        online: false,
        verificationStatus: 'pending',
        documents: action.documents,
        todaOrgId: action.todaOrgId,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        phone: action.phone,
        email: action.email,
        facebook: action.facebook,
        queueJoinedAt: null,
        accessStatus: 'active',
        accessNote: null,
        pendingNote: null,
        pendingNoteDeadline: null,
        pabiliPriority: false,
        rejectionReason: null,
        appealMessage: null,
        appealedAt: null,
      }
      return {
        ...state,
        drivers: [...state.drivers, driver],
        driverInvites: action.inviteId
          ? state.driverInvites.map((inv) =>
              inv.id === action.inviteId ? { ...inv, usedByDriverId: driver.id } : inv,
            )
          : state.driverInvites,
      }
    }
    case 'CREATE_DRIVER_INVITE': {
      const invite: DriverInvite = {
        id: action.id,
        todaOrgId: action.todaOrgId,
        name: action.name,
        phone: action.phone,
        email: action.email,
        createdAt: new Date().toISOString(),
        usedByDriverId: null,
      }
      return { ...state, driverInvites: [invite, ...state.driverInvites] }
    }
    case 'REGISTER_PASSENGER': {
      if (action.age < MINOR_AGE_LIMIT) return state
      const passenger: Passenger = {
        id: action.id,
        name: action.name,
        age: action.age,
        isStudent: false,
        isPwdSenior: false,
        phone: action.phone,
        email: action.email,
        pin: action.pin,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        guardianPhone: action.guardianPhone,
        favoriteDriverId: null,
        savedLocations: [],
      }
      return { ...state, passengers: [...state.passengers, passenger] }
    }
    case 'REGISTER_PARENT_WITH_CHILD': {
      if (action.childAge >= MINOR_AGE_LIMIT) return state
      const parent: Parent = {
        id: action.parentId,
        name: action.parentName,
        phone: action.parentPhone,
        email: action.parentEmail,
        pin: action.parentPin,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        favoriteDriverId: null,
      }
      const child: Passenger = {
        id: action.childId,
        name: action.childName,
        age: action.childAge,
        isStudent: true,
        isPwdSenior: false,
        phone: action.childPhone,
        // Registered by a parent, not self-registered — no login identity
        // of their own (mirrors pax-2 in MOCK_PASSENGERS).
        email: null,
        pin: null,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        guardianPhone: null,
        favoriteDriverId: null,
        savedLocations: [],
      }
      const link: ParentLink = {
        parentId: parent.id,
        studentPassengerId: child.id,
        relationship: action.relationship,
        consentGiven: true,
        proofOfAuthorityDataUrl: action.proofOfAuthorityDataUrl,
        consentedAt: new Date().toISOString(),
      }
      return {
        ...state,
        parents: [...state.parents, parent],
        passengers: [...state.passengers, child],
        parentLinks: [...state.parentLinks, link],
      }
    }
    case 'ADD_ACTIVITY_LOG_ENTRY': {
      const entry: ActivityLogEntry = {
        id: action.id,
        actorRole: action.actorRole,
        actorName: action.actorName,
        todaOrgId: action.todaOrgId,
        action: action.action,
        summary: action.summary,
        at: action.at,
      }
      return { ...state, activityLog: [entry, ...state.activityLog].slice(0, MAX_ACTIVITY_LOG_ENTRIES) }
    }
    case 'ADD_ADVERTISER': {
      const advertiser: Advertiser = {
        id: action.id,
        businessName: action.businessName,
        category: action.category,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        contactName: action.contactName,
        contactPhone: action.contactPhone,
        contactEmail: action.contactEmail,
        plan: action.plan,
        monthlyValue: action.monthlyValue,
        status: action.status,
        joinedAt: new Date().toISOString(),
        notes: action.notes,
      }
      return { ...state, advertisers: [advertiser, ...state.advertisers] }
    }
    case 'UPDATE_ADVERTISER':
      return {
        ...state,
        advertisers: state.advertisers.map((a) =>
          a.id === action.advertiserId
            ? {
                ...a,
                businessName: action.businessName,
                category: action.category,
                province: action.province,
                city: action.city,
                barangay: action.barangay,
                addressDetail: action.addressDetail,
                contactName: action.contactName,
                contactPhone: action.contactPhone,
                contactEmail: action.contactEmail,
                plan: action.plan,
                monthlyValue: action.monthlyValue,
                status: action.status,
                notes: action.notes,
              }
            : a,
        ),
      }
    case 'REMOVE_ADVERTISER':
      return { ...state, advertisers: state.advertisers.filter((a) => a.id !== action.advertiserId) }
    case 'ADD_CAMPAIGN': {
      const campaign: Campaign = {
        id: action.id,
        name: action.name,
        description: action.description,
        type: action.campaignType,
        targetAudience: action.targetAudience,
        startDate: action.startDate,
        endDate: action.endDate,
        rewardCoins: action.rewardCoins,
        rewardNote: action.rewardNote,
        budget: action.budget,
        dailyLimit: action.dailyLimit,
        weeklyLimit: action.weeklyLimit,
        monthlyLimit: action.monthlyLimit,
        status: action.status,
        advertiserId: action.advertiserId,
        reach: 0,
        clicks: 0,
        shares: 0,
        participants: 0,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      }
      return { ...state, campaigns: [campaign, ...state.campaigns] }
    }
    case 'UPDATE_CAMPAIGN':
      return {
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === action.campaignId
            ? {
                ...c,
                name: action.name,
                description: action.description,
                type: action.campaignType,
                targetAudience: action.targetAudience,
                startDate: action.startDate,
                endDate: action.endDate,
                rewardCoins: action.rewardCoins,
                rewardNote: action.rewardNote,
                budget: action.budget,
                dailyLimit: action.dailyLimit,
                weeklyLimit: action.weeklyLimit,
                monthlyLimit: action.monthlyLimit,
                status: action.status,
                advertiserId: action.advertiserId,
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      }
    case 'SET_CAMPAIGN_STATUS':
      return {
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === action.campaignId ? { ...c, status: action.status, updatedAt: new Date().toISOString() } : c,
        ),
      }
    case 'UPDATE_CAMPAIGN_METRICS':
      return {
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === action.campaignId
            ? {
                ...c,
                reach: action.reach,
                clicks: action.clicks,
                shares: action.shares,
                participants: action.participants,
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      }
    case 'REMOVE_CAMPAIGN':
      return { ...state, campaigns: state.campaigns.filter((c) => c.id !== action.campaignId) }
    case 'ADD_PROMO_OFFER': {
      const offer: PromoOffer = {
        id: action.id,
        title: action.title,
        description: action.description,
        kind: action.kind,
        discountType: action.discountType,
        discountValue: action.discountValue,
        code: action.code,
        startDate: action.startDate,
        endDate: action.endDate,
        usageLimit: action.usageLimit,
        timesRedeemed: 0,
        status: action.status,
        createdAt: new Date().toISOString(),
      }
      return { ...state, promoOffers: [offer, ...state.promoOffers] }
    }
    case 'UPDATE_PROMO_OFFER':
      return {
        ...state,
        promoOffers: state.promoOffers.map((o) =>
          o.id === action.offerId
            ? {
                ...o,
                title: action.title,
                description: action.description,
                kind: action.kind,
                discountType: action.discountType,
                discountValue: action.discountValue,
                code: action.code,
                startDate: action.startDate,
                endDate: action.endDate,
                usageLimit: action.usageLimit,
                status: action.status,
              }
            : o,
        ),
      }
    case 'SET_PROMO_OFFER_STATUS':
      return {
        ...state,
        promoOffers: state.promoOffers.map((o) => (o.id === action.offerId ? { ...o, status: action.status } : o)),
      }
    case 'REMOVE_PROMO_OFFER':
      return { ...state, promoOffers: state.promoOffers.filter((o) => o.id !== action.offerId) }
    case 'SET_REWARD_RULES':
      return { ...state, rewardRules: action.rules }
    case 'ADD_COIN_TRANSACTION': {
      const tx: CoinTransaction = {
        id: action.id,
        actorType: action.actorType,
        actorId: action.actorId,
        actorName: action.actorName,
        direction: action.direction,
        source: action.source,
        amount: action.amount,
        campaignId: action.campaignId,
        note: action.note,
        recordedBy: action.recordedBy,
        at: new Date().toISOString(),
      }
      return { ...state, coinTransactions: [tx, ...state.coinTransactions] }
    }
    case 'REMOVE_COIN_TRANSACTION':
      return {
        ...state,
        coinTransactions: state.coinTransactions.filter((t) => t.id !== action.transactionId),
      }
    case 'ADD_RIDE_CREDIT_TIER':
      return {
        ...state,
        rideCreditTiers: [...state.rideCreditTiers, { id: action.id, coins: action.coins, pesoValue: action.pesoValue }],
      }
    case 'UPDATE_RIDE_CREDIT_TIER':
      return {
        ...state,
        rideCreditTiers: state.rideCreditTiers.map((t) =>
          t.id === action.tierId ? { ...t, coins: action.coins, pesoValue: action.pesoValue } : t,
        ),
      }
    case 'REMOVE_RIDE_CREDIT_TIER':
      return { ...state, rideCreditTiers: state.rideCreditTiers.filter((t) => t.id !== action.tierId) }
    case 'ADD_REFERRAL': {
      const referral: Referral = {
        id: action.id,
        code: action.code,
        referrerId: action.referrerId,
        referrerName: action.referrerName,
        referrerType: action.referrerType,
        referredName: action.referredName,
        referredPassengerId: action.referredPassengerId,
        registeredAt: action.referredPassengerId ? new Date().toISOString() : null,
        verifiedAt: null,
        firstRideAt: null,
        status: 'pending',
        coinsAwarded: 0,
        campaignId: action.campaignId,
        createdAt: new Date().toISOString(),
      }
      return { ...state, referrals: [referral, ...state.referrals] }
    }
    case 'SET_REFERRAL_STATUS':
      return {
        ...state,
        referrals: state.referrals.map((r) =>
          r.id === action.referralId
            ? {
                ...r,
                status: action.status,
                coinsAwarded: action.coinsAwarded,
                verifiedAt: action.status === 'qualified' || action.status === 'rewarded' ? (r.verifiedAt ?? new Date().toISOString()) : r.verifiedAt,
              }
            : r,
        ),
      }
    case 'REMOVE_REFERRAL':
      return { ...state, referrals: state.referrals.filter((r) => r.id !== action.referralId) }
    case 'SET_INCOME_PROMOTION_SETTINGS':
      return { ...state, incomePromotionSettings: action.settings }
    case 'ADD_PARTNERSHIP_REVENUE': {
      const entry: PartnershipRevenueEntry = {
        id: action.id,
        partnerName: action.partnerName,
        description: action.description,
        amount: action.amount,
        recordedAt: new Date().toISOString(),
        recordedBy: action.recordedBy,
      }
      return { ...state, partnershipRevenue: [entry, ...state.partnershipRevenue] }
    }
    case 'REMOVE_PARTNERSHIP_REVENUE':
      return { ...state, partnershipRevenue: state.partnershipRevenue.filter((e) => e.id !== action.entryId) }
    case 'SET_ADSENSE_SETTINGS':
      return { ...state, adSenseSettings: action.settings }
    case 'CREATE_MEDS_ORDER': {
      const subtotal = action.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      const hasRxItem = action.items.some(
        (item) => state.medicineProducts.find((p) => p.id === item.productId)?.category === 'rx',
      )
      const order: MedsOrder = {
        id: `meds-${Date.now()}`,
        customerId: action.customerId,
        customerName: action.customerName,
        pharmacyId: action.pharmacyId,
        items: action.items,
        subtotal,
        deliveryFee: DEFAULT_MEDS_DELIVERY_FEE,
        serviceFee: DEFAULT_MEDS_SERVICE_FEE,
        total: subtotal + DEFAULT_MEDS_DELIVERY_FEE + DEFAULT_MEDS_SERVICE_FEE,
        paymentMethod: action.paymentMethod,
        status: 'pending_confirmation',
        rejectionReason: null,
        prescriptionDataUrls: action.prescriptionDataUrls,
        prescriptionStatus: hasRxItem ? 'pending' : 'not_required',
        receiptDataUrl: null,
        deliveryAddress: action.deliveryAddress,
        deliveryMode: action.deliveryMode,
        linkedRideId: null,
        paymentProofDataUrl: null,
        paidOnline: false,
        paymentReference: null,
        requestedAt: new Date().toISOString(),
        quotedAt: null,
        confirmedAt: null,
        messages: [],
      }
      return { ...state, medsOrders: [order, ...state.medsOrders] }
    }
    // Pharmacy prices the order (defaulting to each product's catalog price,
    // but free to override any line item for this specific request — e.g.
    // brand substitution, a price change since the catalog was last
    // updated) and sends it back to the customer as a quote. Requires the
    // prescription (if one was needed) to already be reviewed — mirrors the
    // driver document-verification gate elsewhere in this app.
    case 'PHARMACY_SEND_QUOTE': {
      const order = state.medsOrders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'pending_confirmation' || order.prescriptionStatus === 'pending') return state
      const subtotal = action.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      return {
        ...state,
        medsOrders: state.medsOrders.map((o) =>
          o.id === action.orderId
            ? {
                ...o,
                items: action.items,
                subtotal,
                total: subtotal + o.deliveryFee + o.serviceFee,
                status: 'quoted',
                receiptDataUrl: action.receiptDataUrl,
                quotedAt: new Date().toISOString(),
              }
            : o,
        ),
      }
    }
    case 'PHARMACY_REJECT_MEDS_ORDER':
      return {
        ...state,
        medsOrders: state.medsOrders.map((o) =>
          o.id === action.orderId && (o.status === 'pending_confirmation' || o.status === 'quoted')
            ? { ...o, status: 'rejected', rejectionReason: action.reason }
            : o,
        ),
      }
    case 'CANCEL_MEDS_ORDER':
      return {
        ...state,
        medsOrders: state.medsOrders.map((o) =>
          o.id === action.orderId &&
          (o.status === 'pending_confirmation' || o.status === 'quoted' || o.status === 'confirmed')
            ? { ...o, status: 'cancelled' }
            : o,
        ),
      }
    case 'SEND_MEDS_ORDER_MESSAGE': {
      const order = state.medsOrders.find((o) => o.id === action.orderId)
      if (!order || !action.text.trim()) return state
      const message: OrderMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: action.sender,
        text: action.text.trim(),
        sentAt: new Date().toISOString(),
      }
      return {
        ...state,
        medsOrders: state.medsOrders.map((o) => (o.id === action.orderId ? { ...o, messages: [...o.messages, message] } : o)),
      }
    }
    case 'REVIEW_MEDS_PRESCRIPTION':
      return {
        ...state,
        medsOrders: state.medsOrders.map((o) =>
          o.id === action.orderId
            ? {
                ...o,
                prescriptionStatus: action.approved ? 'approved' : 'rejected',
                rejectionReason: action.approved ? o.rejectionReason : action.reason,
              }
            : o,
        ),
      }
    // The customer accepts the pharmacy's quote and checks out — this is
    // the gate the pharmacy waits behind: PHARMACY_PROCESS_MEDS_ORDER
    // refuses to run until an order reaches 'confirmed'. An online method
    // (gcash/maya/card) is treated as paid immediately (same "Prototype ·
    // Simulated data" spirit as the rest of the app — no real gateway, just
    // an instant recorded confirmation); cash stays unpaid here and is
    // still collected/confirmed at delivery via the linked Ride's existing
    // payment flow, unchanged.
    case 'CUSTOMER_ACCEPT_QUOTE': {
      const order = state.medsOrders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'quoted') return state
      const paidOnline = action.paymentMethod !== 'cash'
      return {
        ...state,
        medsOrders: state.medsOrders.map((o) =>
          o.id === action.orderId
            ? {
                ...o,
                paymentMethod: action.paymentMethod,
                status: 'confirmed',
                paidOnline,
                paymentReference: paidOnline ? `ONLINE-${Date.now()}` : null,
                paymentProofDataUrl: action.paymentProofDataUrl,
                deliveryMode: action.deliveryMode,
                confirmedAt: new Date().toISOString(),
              }
            : o,
        ),
      }
    }
    // Only runs once the customer has checked out (status 'confirmed') —
    // dispatches a real Ride right away for 'pharmacy_books' orders, or
    // leaves the order at 'ready_for_pickup' for the customer to dispatch
    // themselves via MEDS_ORDER_BOOK_OWN_RIDE for 'self_book' orders.
    case 'PHARMACY_PROCESS_MEDS_ORDER': {
      const order = state.medsOrders.find((o) => o.id === action.orderId)
      const pharmacy = order ? state.pharmacies.find((p) => p.id === order.pharmacyId) : undefined
      if (!order || !pharmacy || order.status !== 'confirmed') return state
      if (order.deliveryMode === 'self_book') {
        return {
          ...state,
          medsOrders: state.medsOrders.map((o) => (o.id === action.orderId ? { ...o, status: 'ready_for_pickup' } : o)),
        }
      }
      const ride = buildMedsDeliveryRide(state, order, pharmacy)
      return {
        ...state,
        rides: [ride, ...state.rides],
        medsOrders: state.medsOrders.map((o) => (o.id === action.orderId ? { ...o, status: 'dispatched', linkedRideId: ride.id } : o)),
      }
    }
    case 'MEDS_ORDER_BOOK_OWN_RIDE': {
      const order = state.medsOrders.find((o) => o.id === action.orderId)
      const pharmacy = order ? state.pharmacies.find((p) => p.id === order.pharmacyId) : undefined
      if (!order || !pharmacy || order.status !== 'ready_for_pickup') return state
      const ride = buildMedsDeliveryRide(state, order, pharmacy)
      return {
        ...state,
        rides: [ride, ...state.rides],
        medsOrders: state.medsOrders.map((o) => (o.id === action.orderId ? { ...o, status: 'dispatched', linkedRideId: ride.id } : o)),
      }
    }
    case 'REGISTER_PHARMACY': {
      const pharmacy: Pharmacy = {
        id: action.id,
        name: action.name,
        businessType: action.businessType,
        adminPin: action.adminPin,
        contactPhone: action.contactPhone,
        province: action.province,
        city: action.city,
        barangay: action.barangay,
        addressDetail: action.addressDetail,
        coords: action.coords,
        locationGps: action.locationGps,
        isOpen: true,
        // Self-service signups go live immediately, same as the seeded
        // pharmacies — no Admin-approval workflow built for MEDS yet.
        verificationStatus: 'approved',
        gcashAccount: null,
        mayaAccount: null,
      }
      return { ...state, pharmacies: [...state.pharmacies, pharmacy] }
    }
    case 'UPDATE_PHARMACY_PAYMENT_ACCOUNT': {
      return {
        ...state,
        pharmacies: state.pharmacies.map((p) =>
          p.id === action.pharmacyId
            ? { ...p, [action.method === 'gcash' ? 'gcashAccount' : 'mayaAccount']: action.details }
            : p,
        ),
      }
    }
    case 'ADD_MEDICINE_PRODUCT': {
      const product: MedicineProduct = {
        id: action.id,
        pharmacyId: action.pharmacyId,
        name: action.name,
        genericName: action.genericName,
        category: action.category,
        price: action.price,
        inStock: true,
      }
      return { ...state, medicineProducts: [...state.medicineProducts, product] }
    }
    case 'TOGGLE_MEDICINE_PRODUCT_STOCK':
      return {
        ...state,
        medicineProducts: state.medicineProducts.map((p) =>
          p.id === action.productId ? { ...p, inStock: !p.inStock } : p,
        ),
      }
    default:
      return state
  }
}

interface RideContextValue extends RideState {
  requestRide: (args: {
    passengerId: string
    passengerName: string
    passengerPhone?: string | null
    pickup: MockLocation
    dropoff: MockLocation
    paymentMethod: PaymentMethod
    isStudentRide: boolean
    isPwdSeniorRide: boolean
    pickupGps: GeoCoords | null
    passengerCount: number
    serviceType?: ServiceType
    pabiliItems?: string | null
    tip?: number
    bookedByParentId?: string | null
    specialPickupRequested?: boolean
    prescriptionDataUrls?: string[]
    seniorIdDataUrl?: string | null
    otherDocDataUrl?: string | null
    paymentProofDataUrl?: string | null
  }) => void
  acceptRide: (rideId: string, driverId: string) => void
  declineRide: (rideId: string, driverId: string) => void
  startRide: (rideId: string) => void
  completeRide: (rideId: string) => void
  cancelRide: (rideId: string) => void
  addTipOffer: (rideId: string, amount: number) => void
  acknowledgeRidePayment: (rideId: string, method: PaymentMethod) => void
  updateDriverLiveGps: (rideId: string, gps: GeoCoords | null) => void
  updatePassengerLiveGps: (rideId: string, gps: GeoCoords | null) => void
  triggerSos: (rideId: string, triggeredBy: string) => void
  triggerDriverSos: (driverId: string, location: GeoCoords | null, notes?: string | null) => void
  resolveAlert: (alertId: string) => void
  approveDriver: (driverId: string) => void
  rejectDriver: (driverId: string, reason?: string | null) => void
  appealDriverRejection: (driverId: string, message: string) => void
  resubmitDriverDocument: (driverId: string, docType: DocumentType, dataUrl: string) => void
  addSafetyPhoto: (rideId: string, dataUrl: string, takenBy: string) => void
  setCommission: (amount: number) => void
  joinTerminalQueue: (driverId: string, driverGps: GeoCoords | null) => void
  leaveTerminalQueue: (driverId: string) => void
  setTodaQueueWindowMs: (ms: number) => void
  setSpecialPickupEscalationMs: (ms: number) => void
  setFavoriteDriver: (passengerId: string, driverId: string | null) => void
  setParentFavoriteDriver: (parentId: string, driverId: string | null) => void
  proposeTodaCommission: (todaOrgId: string, amount: number | null) => void
  setTodaCommissionMemberApproval: (todaOrgId: string, approved: boolean) => void
  setTodaCommissionAdminApproval: (todaOrgId: string, approved: boolean) => void
  addDuesRecord: (args: {
    todaOrgId: string
    driverIds: string[]
    duesType: DuesType
    label: string
    amount: number
    dueDate: string
  }) => void
  markDuesPaid: (duesRecordId: string) => void
  requestMembershipAction: (args: {
    todaOrgId: string
    driverId: string
    requestType: MembershipRequestType
    reason: string
  }) => void
  resolveMembershipRequest: (requestId: string, approve: boolean) => void
  setDriverAccess: (driverId: string, accessStatus: DriverAccessStatus, accessNote: string | null) => void
  setDriverPabiliPriority: (driverId: string, enabled: boolean) => void
  setDriverOnline: (driverId: string, online: boolean) => void
  updatePassengerProfile: (
    passengerId: string,
    updates: {
      name: string
      phone: string
      email: string | null
      pin: string | null
      paymentDetail: string | null
      password: string | null
      guardianPhone: string | null
    },
  ) => void
  updateDriverProfile: (
    driverId: string,
    updates: {
      name: string
      phone: string
      email: string | null
      pin: string
      paymentDetail: string | null
      password: string | null
      emergencyContact: string | null
    },
  ) => void
  updateParentProfile: (
    parentId: string,
    updates: {
      name: string
      phone: string
      email: string | null
      pin: string | null
      paymentDetail: string | null
      password: string | null
      emergencyContact: string | null
    },
  ) => void
  updatePharmacyProfile: (
    pharmacyId: string,
    updates: {
      name: string
      phone: string
      email: string | null
      pin: string
      paymentDetail: string | null
      password: string | null
      emergencyContact: string | null
    },
  ) => void
  setDuesGracePeriodDays: (days: number) => void
  setTripHistoryRetentionDays: (days: number) => void
  setDriverPendingNote: (driverId: string, note: string | null, deadline?: string | null) => void
  registerTodaOrganization: (args: {
    name: string
    officers: TodaOfficer[]
    province: string
    city: string
    barangay: string
    addressDetail: string
    terminalGps: GeoCoords | null
    adminPin: string
  }) => string
  approveTodaOrg: (todaOrgId: string) => void
  rejectTodaOrg: (todaOrgId: string) => void
  setTodaOrgPendingNote: (todaOrgId: string, note: string | null, deadline?: string | null) => void
  setTodaSaasPlan: (todaOrgId: string, plan: SaasPlan, perBookingFee: number) => void
  setTodaOperator: (todaOrgId: string, operatorId: string | null) => void
  registerOperator: (args: {
    name: string
    contactPerson: string
    contactPhone: string
    province: string
    city: string
    adminPin: string
  }) => string
  approveOperator: (operatorId: string) => void
  rejectOperator: (operatorId: string) => void
  setOperatorFees: (operatorId: string, activationFee: number | null, monthlyPlatformFee: number, perBookingFee: number) => void
  setOperatorFranchise: (operatorId: string, franchiseId: string | null) => void
  updateOperatorProfile: (
    operatorId: string,
    updates: {
      contactPerson: string
      contactPhone: string
      email: string | null
      province: string
      city: string
      barangay: string
      addressDetail: string
      businessRegistrationNo: string | null
    },
  ) => void
  registerFranchise: (args: {
    name: string
    contactPerson: string
    contactPhone: string
    province: string
    city: string
    adminPin: string
  }) => string
  approveFranchise: (franchiseId: string) => void
  rejectFranchise: (franchiseId: string) => void
  setFranchiseFees: (
    franchiseId: string,
    initialFranchiseFee: number | null,
    monthlyTechnologyFee: number,
    royaltyPct: number | null,
  ) => void
  updateFranchiseProfile: (
    franchiseId: string,
    updates: {
      contactPerson: string
      contactPhone: string
      email: string | null
      province: string
      city: string
      barangay: string
      addressDetail: string
      businessRegistrationNo: string | null
    },
  ) => void
  setTodaTerminalGps: (todaOrgId: string, gps: GeoCoords) => void
  setTodaTerminalAddress: (
    todaOrgId: string,
    args: { province: string; city: string; barangay: string; addressDetail: string },
  ) => void
  setTariffSettings: (settings: TariffSettings) => void
  setPabiliServiceFee: (amount: number) => void
  addExpense: (args: { category: ExpenseCategory; amount: number; description: string; recordedBy: string }) => void
  deleteExpense: (expenseId: string) => void
  toggleComplianceItem: (itemId: string, done: boolean) => void
  setComplianceNote: (itemId: string, note: string | null, deadlineAt?: string | null) => void
  addCapitalContribution: (args: {
    stockholderName: string
    shares: number
    amount: number
    recordedBy: string
  }) => void
  deleteCapitalContribution: (contributionId: string) => void
  addAccountingOfficer: (args: {
    name: string
    email: string
    position: AccountingOfficerPosition
    otherPositionLabel?: string | null
  }) => void
  removeAccountingOfficer: (officerId: string) => void
  updateAccountingOfficer: (
    officerId: string,
    args: { name: string; email: string; position: AccountingOfficerPosition; otherPositionLabel?: string | null },
  ) => void
  addEquityAllocation: (args: {
    holderName: string
    category: EquityHolderCategory
    otherCategoryLabel?: string | null
    percentage: number
    notes?: string | null
  }) => void
  updateEquityAllocation: (
    allocationId: string,
    args: {
      holderName: string
      category: EquityHolderCategory
      otherCategoryLabel?: string | null
      percentage: number
      notes?: string | null
    },
  ) => void
  removeEquityAllocation: (allocationId: string) => void
  addInvestor: (args: {
    investorName: string
    investmentDate: string
    investmentAmount: number
    investmentRound: string
    preMoneyValuation?: number | null
    postMoneyValuation?: number | null
    sharePercentage: number
    shareClass: ShareClass
    agreementReference?: string | null
    status: InvestorStatus
    notes?: string | null
  }) => void
  updateInvestor: (
    investorId: string,
    args: {
      investorName: string
      investmentDate: string
      investmentAmount: number
      investmentRound: string
      preMoneyValuation?: number | null
      postMoneyValuation?: number | null
      sharePercentage: number
      shareClass: ShareClass
      agreementReference?: string | null
      status: InvestorStatus
      notes?: string | null
    },
  ) => void
  removeInvestor: (investorId: string) => void
  addFounderContribution: (args: {
    founderName: string
    date: string
    contributionType: string
    description: string
    kind: FounderContributionKind
    estimatedValue: number
    supportingDocDataUrl?: string | null
  }) => void
  updateFounderContribution: (
    contributionId: string,
    args: {
      founderName: string
      date: string
      contributionType: string
      description: string
      kind: FounderContributionKind
      estimatedValue: number
      supportingDocDataUrl?: string | null
    },
  ) => void
  setFounderContributionStatus: (
    contributionId: string,
    status: FounderContributionStatus,
    approvedValue: number | null,
    approvedBy: string,
  ) => void
  removeFounderContribution: (contributionId: string) => void
  setSocialImpactFundPct: (pct: number) => void
  addSocialImpactTransaction: (args: {
    date: string
    description: string
    amount: number
    projectId?: string | null
    category: SocialImpactTransactionCategory
    status: SocialImpactTransactionStatus
    approvedBy?: string | null
    supportingDocDataUrl?: string | null
  }) => void
  setSocialImpactTransactionStatus: (
    transactionId: string,
    status: SocialImpactTransactionStatus,
    approvedBy: string,
  ) => void
  removeSocialImpactTransaction: (transactionId: string) => void
  addRotaryProject: (args: {
    projectName: string
    partner: string
    description: string
    category: RotaryProjectCategory
    approvedBudget: number
    socialImpactFundAllocation: number
    additionalFunding: number
    status: RotaryProjectStatus
    startDate?: string | null
    endDate?: string | null
  }) => void
  updateRotaryProject: (
    projectId: string,
    args: {
      projectName: string
      partner: string
      description: string
      category: RotaryProjectCategory
      approvedBudget: number
      socialImpactFundAllocation: number
      additionalFunding: number
      status: RotaryProjectStatus
      startDate?: string | null
      endDate?: string | null
    },
  ) => void
  removeRotaryProject: (projectId: string) => void
  addDistribution: (args: {
    recipient: string
    distributionType: DistributionType
    amount: number
    date: string
    source: string
    reference?: string | null
    status: DistributionStatus
    approvedBy?: string | null
  }) => void
  updateDistribution: (
    distributionId: string,
    args: {
      recipient: string
      distributionType: DistributionType
      amount: number
      date: string
      source: string
      reference?: string | null
      status: DistributionStatus
      approvedBy?: string | null
    },
  ) => void
  removeDistribution: (distributionId: string) => void
  addRccIncentive: (args: {
    partner: string
    basis: RccIncentiveBasis
    description: string
    amount: number
    date: string
    status: RccIncentiveStatus
    approvedBy?: string | null
  }) => void
  updateRccIncentive: (
    incentiveId: string,
    args: {
      partner: string
      basis: RccIncentiveBasis
      description: string
      amount: number
      date: string
      status: RccIncentiveStatus
      approvedBy?: string | null
    },
  ) => void
  removeRccIncentive: (incentiveId: string) => void
  updateCorporateRegistration: (info: CorporateRegistrationInfo) => void
  addStockholder: (args: {
    name: string
    nationality: string
    address: string
    stockholderType: StockholderType
    sharesSubscribed: number
    amountSubscribed: number
    amountPaid: number
    dateSubscribed?: string | null
    certificateNo?: string | null
  }) => void
  updateStockholder: (
    stockholderId: string,
    args: {
      name: string
      nationality: string
      address: string
      stockholderType: StockholderType
      sharesSubscribed: number
      amountSubscribed: number
      amountPaid: number
      dateSubscribed?: string | null
      certificateNo?: string | null
    },
  ) => void
  removeStockholder: (stockholderId: string) => void
  addTodaContribution: (args: {
    todaOrgId: string
    contributorName: string
    purpose: string
    amount: number
    recordedBy: string
  }) => void
  deleteTodaContribution: (contributionId: string) => void
  addTodaExpense: (args: {
    todaOrgId: string
    category: TodaExpenseCategory
    amount: number
    description: string
    recordedBy: string
  }) => void
  deleteTodaExpense: (expenseId: string) => void
  savePassengerLocation: (passengerId: string, label: SavedLocationLabel, location: MockLocation) => void
  removePassengerLocation: (passengerId: string, savedLocationId: string) => void
  rateRide: (args: {
    rideId: string
    driverRating: number
    driverReviewText: string
    todaRating: number | null
    todaReviewText: string
  }) => void
  reportDriver: (args: {
    rideId: string
    passengerId: string
    passengerName: string
    driverId: string
    driverName: string
    reason: DriverReportReason
    details: string
  }) => void
  resolveDriverReport: (reportId: string) => void
  registerDriver: (args: {
    name: string
    plateNumber: string
    licenseNo: string
    licenseExpiry: string
    pin: string
    documents: DriverDocuments
    todaOrgId: string | null
    province: string
    city: string
    barangay: string
    addressDetail: string
    phone: string
    email: string | null
    facebook: string | null
    inviteId?: string | null
  }) => void
  createDriverInvite: (args: { todaOrgId: string; name: string; phone: string; email: string | null }) => string
  registerPassenger: (args: {
    name: string
    age: number
    phone: string
    email: string | null
    pin: string
    province: string
    city: string
    barangay: string
    addressDetail: string
    guardianPhone: string | null
  }) => string | null
  registerParentWithChild: (args: {
    parentName: string
    parentPhone: string
    parentEmail: string | null
    parentPin: string
    childName: string
    childAge: number
    childPhone: string
    relationship: string
    province: string
    city: string
    barangay: string
    addressDetail: string
    proofOfAuthorityDataUrl: string | null
  }) => { parentId: string; childId: string } | null
  logActivity: (args: {
    actorRole: ActivityLogActorRole
    actorName: string
    todaOrgId: string | null
    action: string
    summary: string
  }) => void
  addAdvertiser: (args: {
    businessName: string
    category: string
    province: string
    city: string
    barangay: string
    addressDetail: string
    contactName: string
    contactPhone: string
    contactEmail?: string | null
    plan: AdvertiserPlan
    monthlyValue: number
    status: AdvertiserStatus
    notes?: string | null
  }) => void
  updateAdvertiser: (
    advertiserId: string,
    args: {
      businessName: string
      category: string
      province: string
      city: string
      barangay: string
      addressDetail: string
      contactName: string
      contactPhone: string
      contactEmail?: string | null
      plan: AdvertiserPlan
      monthlyValue: number
      status: AdvertiserStatus
      notes?: string | null
    },
  ) => void
  removeAdvertiser: (advertiserId: string) => void
  addCampaign: (args: {
    name: string
    description: string
    campaignType: CampaignType
    targetAudience: CampaignAudience
    startDate: string
    endDate?: string | null
    rewardCoins: number
    rewardNote?: string | null
    budget: number
    dailyLimit?: number | null
    weeklyLimit?: number | null
    monthlyLimit?: number | null
    status: CampaignStatus
    advertiserId?: string | null
  }) => void
  updateCampaign: (
    campaignId: string,
    args: {
      name: string
      description: string
      campaignType: CampaignType
      targetAudience: CampaignAudience
      startDate: string
      endDate?: string | null
      rewardCoins: number
      rewardNote?: string | null
      budget: number
      dailyLimit?: number | null
      weeklyLimit?: number | null
      monthlyLimit?: number | null
      status: CampaignStatus
      advertiserId?: string | null
    },
  ) => void
  setCampaignStatus: (campaignId: string, status: CampaignStatus) => void
  updateCampaignMetrics: (
    campaignId: string,
    args: { reach: number; clicks: number; shares: number; participants: number },
  ) => void
  removeCampaign: (campaignId: string) => void
  addPromoOffer: (args: {
    title: string
    description: string
    kind: PromoOfferKind
    discountType: PromoDiscountType
    discountValue: number
    code?: string | null
    startDate: string
    endDate?: string | null
    usageLimit?: number | null
    status: PromoOfferStatus
  }) => void
  updatePromoOffer: (
    offerId: string,
    args: {
      title: string
      description: string
      kind: PromoOfferKind
      discountType: PromoDiscountType
      discountValue: number
      code?: string | null
      startDate: string
      endDate?: string | null
      usageLimit?: number | null
      status: PromoOfferStatus
    },
  ) => void
  setPromoOfferStatus: (offerId: string, status: PromoOfferStatus) => void
  removePromoOffer: (offerId: string) => void
  setRewardRules: (rules: RewardRules) => void
  addCoinTransaction: (args: {
    actorType: 'passenger' | 'driver'
    actorId: string
    actorName: string
    direction: CoinDirection
    source: CoinSource
    amount: number
    campaignId?: string | null
    note?: string | null
    recordedBy: string
  }) => void
  removeCoinTransaction: (transactionId: string) => void
  addRideCreditTier: (coins: number, pesoValue: number) => void
  updateRideCreditTier: (tierId: string, coins: number, pesoValue: number) => void
  removeRideCreditTier: (tierId: string) => void
  addReferral: (args: {
    code: string
    referrerId: string
    referrerName: string
    referrerType: 'passenger' | 'driver'
    referredName: string
    referredPassengerId?: string | null
    campaignId?: string | null
  }) => void
  setReferralStatus: (referralId: string, status: ReferralStatus, coinsAwarded: number) => void
  removeReferral: (referralId: string) => void
  setIncomePromotionSettings: (settings: IncomePromotionSettings) => void
  addPartnershipRevenue: (args: { partnerName: string; description: string; amount: number; recordedBy: string }) => void
  removePartnershipRevenue: (entryId: string) => void
  setAdSenseSettings: (settings: AdSenseSettings) => void
  createMedsOrder: (args: {
    customerId: string
    customerName: string
    pharmacyId: string
    items: MedsOrderItem[]
    deliveryAddress: MockLocation
    prescriptionDataUrls: string[]
    paymentMethod: PaymentMethod
    deliveryMode: 'pharmacy_books' | 'self_book'
  }) => void
  sendMedsQuote: (orderId: string, items: MedsOrderItem[], receiptDataUrl: string | null) => void
  rejectMedsOrder: (orderId: string, reason: string) => void
  reviewMedsPrescription: (orderId: string, approved: boolean, reason: string | null) => void
  acceptMedsQuote: (
    orderId: string,
    paymentMethod: PaymentMethod,
    paymentProofDataUrl: string | null,
    deliveryMode: 'pharmacy_books' | 'self_book',
  ) => void
  cancelMedsOrder: (orderId: string) => void
  sendMedsOrderMessage: (orderId: string, sender: 'customer' | 'pharmacy', text: string) => void
  processMedsOrder: (orderId: string) => void
  bookOwnMedsRide: (orderId: string) => void
  toggleMedicineProductStock: (productId: string) => void
  registerPharmacy: (args: {
    name: string
    businessType: BusinessType
    contactPhone: string
    province: string
    city: string
    barangay: string
    addressDetail: string
    coords: Coords
    locationGps: GeoCoords | null
    adminPin: string
  }) => string
  addMedicineProduct: (args: {
    pharmacyId: string
    name: string
    genericName: string | null
    category: MedicineCategory
    price: number
  }) => void
  updatePharmacyPaymentAccount: (pharmacyId: string, method: 'gcash' | 'maya', details: PaymentAccountDetails | null) => void
}

const RideContext = createContext<RideContextValue | null>(null)

export function RideProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rides: state.rides,
        alerts: state.alerts,
        drivers: state.drivers,
        passengers: state.passengers,
        parents: state.parents,
        parentLinks: state.parentLinks,
        commissionPerRide: state.commissionPerRide,
        todaQueueWindowMs: state.todaQueueWindowMs,
        specialPickupEscalationMs: state.specialPickupEscalationMs,
        todaOrganizations: state.todaOrganizations,
        duesRecords: state.duesRecords,
        membershipRequests: state.membershipRequests,
        duesGracePeriodDays: state.duesGracePeriodDays,
        tripHistoryRetentionDays: state.tripHistoryRetentionDays,
        tariffSettings: state.tariffSettings,
        driverReports: state.driverReports,
        pabiliServiceFee: state.pabiliServiceFee,
        expenses: state.expenses,
        complianceChecked: state.complianceChecked,
        capitalContributions: state.capitalContributions,
        todaContributions: state.todaContributions,
        todaExpenses: state.todaExpenses,
        complianceReview: state.complianceReview,
        driverInvites: state.driverInvites,
        accountingOfficers: state.accountingOfficers,
        equityAllocations: state.equityAllocations,
        investors: state.investors,
        founderContributions: state.founderContributions,
        socialImpactFundPct: state.socialImpactFundPct,
        socialImpactTransactions: state.socialImpactTransactions,
        rotaryProjects: state.rotaryProjects,
        distributions: state.distributions,
        rccIncentives: state.rccIncentives,
        corporateRegistration: state.corporateRegistration,
        stockholders: state.stockholders,
        activityLog: state.activityLog,
        advertisers: state.advertisers,
        campaigns: state.campaigns,
        promoOffers: state.promoOffers,
        rewardRules: state.rewardRules,
        coinTransactions: state.coinTransactions,
        rideCreditTiers: state.rideCreditTiers,
        referrals: state.referrals,
        incomePromotionSettings: state.incomePromotionSettings,
        partnershipRevenue: state.partnershipRevenue,
        adSenseSettings: state.adSenseSettings,
        pharmacies: state.pharmacies,
        medicineProducts: state.medicineProducts,
        medsOrders: state.medsOrders,
        operators: state.operators,
        franchises: state.franchises,
      }),
    )
  }, [
    state.rides,
    state.alerts,
    state.drivers,
    state.passengers,
    state.parents,
    state.parentLinks,
    state.commissionPerRide,
    state.todaQueueWindowMs,
    state.specialPickupEscalationMs,
    state.todaOrganizations,
    state.duesRecords,
    state.membershipRequests,
    state.duesGracePeriodDays,
    state.tripHistoryRetentionDays,
    state.tariffSettings,
    state.driverReports,
    state.pabiliServiceFee,
    state.expenses,
    state.complianceChecked,
    state.capitalContributions,
    state.todaContributions,
    state.todaExpenses,
    state.complianceReview,
    state.driverInvites,
    state.accountingOfficers,
    state.equityAllocations,
    state.investors,
    state.founderContributions,
    state.socialImpactFundPct,
    state.socialImpactTransactions,
    state.rotaryProjects,
    state.distributions,
    state.rccIncentives,
    state.corporateRegistration,
    state.stockholders,
    state.activityLog,
    state.advertisers,
    state.campaigns,
    state.promoOffers,
    state.rewardRules,
    state.coinTransactions,
    state.rideCreditTiers,
    state.referrals,
    state.incomePromotionSettings,
    state.partnershipRevenue,
    state.adSenseSettings,
    state.pharmacies,
    state.medicineProducts,
    state.medsOrders,
    state.operators,
    state.franchises,
  ])

  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: 'TICK_POSITIONS' }), TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Keep separate tabs/roles (e.g. student on one device, parent on another)
  // in sync so alerts like SOS and safety photos show up immediately everywhere.
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        dispatch({ type: 'HYDRATE', state: fromStored(JSON.parse(e.newValue) as StoredState) })
      } catch {
        // ignore corrupt storage
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const value: RideContextValue = {
    ...state,
    requestRide: (args) =>
      dispatch({
        type: 'REQUEST_RIDE',
        serviceType: 'ride',
        pabiliItems: null,
        tip: 0,
        bookedByParentId: null,
        passengerPhone: null,
        specialPickupRequested: false,
        prescriptionDataUrls: [],
        seniorIdDataUrl: null,
        otherDocDataUrl: null,
        paymentProofDataUrl: null,
        ...args,
      }),
    acceptRide: (rideId, driverId) => dispatch({ type: 'ACCEPT_RIDE', rideId, driverId }),
    declineRide: (rideId, driverId) => dispatch({ type: 'DECLINE_RIDE', rideId, driverId }),
    startRide: (rideId) => dispatch({ type: 'START_RIDE', rideId }),
    completeRide: (rideId) => dispatch({ type: 'COMPLETE_RIDE', rideId }),
    cancelRide: (rideId) => dispatch({ type: 'CANCEL_RIDE', rideId }),
    addTipOffer: (rideId, amount) => dispatch({ type: 'ADD_TIP_OFFER', rideId, amount }),
    acknowledgeRidePayment: (rideId, method) => dispatch({ type: 'ACKNOWLEDGE_RIDE_PAYMENT', rideId, method }),
    updateDriverLiveGps: (rideId, gps) => dispatch({ type: 'UPDATE_DRIVER_LIVE_GPS', rideId, gps }),
    updatePassengerLiveGps: (rideId, gps) => dispatch({ type: 'UPDATE_PASSENGER_LIVE_GPS', rideId, gps }),
    triggerSos: (rideId, triggeredBy) => dispatch({ type: 'TRIGGER_SOS', rideId, triggeredBy }),
    triggerDriverSos: (driverId, location, notes = null) =>
      dispatch({ type: 'TRIGGER_DRIVER_SOS', driverId, location, notes }),
    resolveAlert: (alertId) => dispatch({ type: 'RESOLVE_ALERT', alertId }),
    approveDriver: (driverId) => dispatch({ type: 'APPROVE_DRIVER', driverId }),
    rejectDriver: (driverId, reason = null) => dispatch({ type: 'REJECT_DRIVER', driverId, reason }),
    appealDriverRejection: (driverId, message) => dispatch({ type: 'APPEAL_DRIVER_REJECTION', driverId, message }),
    resubmitDriverDocument: (driverId, docType, dataUrl) =>
      dispatch({ type: 'RESUBMIT_DRIVER_DOCUMENT', driverId, docType, dataUrl }),
    addSafetyPhoto: (rideId, dataUrl, takenBy) => dispatch({ type: 'ADD_SAFETY_PHOTO', rideId, dataUrl, takenBy }),
    setCommission: (amount) => dispatch({ type: 'SET_COMMISSION', amount }),
    joinTerminalQueue: (driverId, driverGps) => dispatch({ type: 'JOIN_TERMINAL_QUEUE', driverId, driverGps }),
    leaveTerminalQueue: (driverId) => dispatch({ type: 'LEAVE_TERMINAL_QUEUE', driverId }),
    setTodaQueueWindowMs: (ms) => dispatch({ type: 'SET_TODA_QUEUE_WINDOW', ms }),
    setSpecialPickupEscalationMs: (ms) => dispatch({ type: 'SET_SPECIAL_PICKUP_ESCALATION_MS', ms }),
    setFavoriteDriver: (passengerId, driverId) => dispatch({ type: 'SET_FAVORITE_DRIVER', passengerId, driverId }),
    setParentFavoriteDriver: (parentId, driverId) => dispatch({ type: 'SET_PARENT_FAVORITE_DRIVER', parentId, driverId }),
    proposeTodaCommission: (todaOrgId, amount) => dispatch({ type: 'PROPOSE_TODA_COMMISSION', todaOrgId, amount }),
    setTodaCommissionMemberApproval: (todaOrgId, approved) =>
      dispatch({ type: 'SET_TODA_COMMISSION_MEMBER_APPROVAL', todaOrgId, approved }),
    setTodaCommissionAdminApproval: (todaOrgId, approved) =>
      dispatch({ type: 'SET_TODA_COMMISSION_ADMIN_APPROVAL', todaOrgId, approved }),
    addDuesRecord: (args) => dispatch({ type: 'ADD_DUES_RECORD', ...args }),
    markDuesPaid: (duesRecordId) => dispatch({ type: 'MARK_DUES_PAID', duesRecordId }),
    requestMembershipAction: (args) => dispatch({ type: 'REQUEST_MEMBERSHIP_ACTION', ...args }),
    resolveMembershipRequest: (requestId, approve) =>
      dispatch({ type: 'RESOLVE_MEMBERSHIP_REQUEST', requestId, approve }),
    setDriverAccess: (driverId, accessStatus, accessNote) =>
      dispatch({ type: 'SET_DRIVER_ACCESS', driverId, accessStatus, accessNote }),
    setDriverPabiliPriority: (driverId, enabled) => dispatch({ type: 'SET_DRIVER_PABILI_PRIORITY', driverId, enabled }),
    setDriverOnline: (driverId, online) => dispatch({ type: 'SET_DRIVER_ONLINE', driverId, online }),
    updatePassengerProfile: (passengerId, updates) =>
      dispatch({ type: 'UPDATE_PASSENGER_PROFILE', passengerId, ...updates }),
    updateDriverProfile: (driverId, updates) => dispatch({ type: 'UPDATE_DRIVER_PROFILE', driverId, ...updates }),
    updateParentProfile: (parentId, updates) => dispatch({ type: 'UPDATE_PARENT_PROFILE', parentId, ...updates }),
    updatePharmacyProfile: (pharmacyId, updates) =>
      dispatch({ type: 'UPDATE_PHARMACY_PROFILE', pharmacyId, ...updates }),
    setDuesGracePeriodDays: (days) => dispatch({ type: 'SET_DUES_GRACE_PERIOD_DAYS', days }),
    setTripHistoryRetentionDays: (days) => dispatch({ type: 'SET_TRIP_HISTORY_RETENTION_DAYS', days }),
    setDriverPendingNote: (driverId, note, deadline = null) =>
      dispatch({ type: 'SET_DRIVER_PENDING_NOTE', driverId, note, deadline }),
    registerTodaOrganization: (args) => {
      const id = `toda-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'REGISTER_TODA_ORGANIZATION', id, ...args })
      return id
    },
    approveTodaOrg: (todaOrgId) => dispatch({ type: 'APPROVE_TODA_ORG', todaOrgId }),
    rejectTodaOrg: (todaOrgId) => dispatch({ type: 'REJECT_TODA_ORG', todaOrgId }),
    setTodaOrgPendingNote: (todaOrgId, note, deadline = null) =>
      dispatch({ type: 'SET_TODA_ORG_PENDING_NOTE', todaOrgId, note, deadline }),
    setTodaSaasPlan: (todaOrgId, plan, perBookingFee) =>
      dispatch({ type: 'SET_TODA_SAAS_PLAN', todaOrgId, plan, perBookingFee }),
    setTodaOperator: (todaOrgId, operatorId) => dispatch({ type: 'SET_TODA_OPERATOR', todaOrgId, operatorId }),
    registerOperator: (args) => {
      const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'REGISTER_OPERATOR', id, ...args })
      return id
    },
    approveOperator: (operatorId) => dispatch({ type: 'APPROVE_OPERATOR', operatorId }),
    rejectOperator: (operatorId) => dispatch({ type: 'REJECT_OPERATOR', operatorId }),
    setOperatorFees: (operatorId, activationFee, monthlyPlatformFee, perBookingFee) =>
      dispatch({ type: 'SET_OPERATOR_FEES', operatorId, activationFee, monthlyPlatformFee, perBookingFee }),
    setOperatorFranchise: (operatorId, franchiseId) =>
      dispatch({ type: 'SET_OPERATOR_FRANCHISE', operatorId, franchiseId }),
    updateOperatorProfile: (operatorId, updates) => dispatch({ type: 'UPDATE_OPERATOR_PROFILE', operatorId, ...updates }),
    registerFranchise: (args) => {
      const id = `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'REGISTER_FRANCHISE', id, ...args })
      return id
    },
    approveFranchise: (franchiseId) => dispatch({ type: 'APPROVE_FRANCHISE', franchiseId }),
    rejectFranchise: (franchiseId) => dispatch({ type: 'REJECT_FRANCHISE', franchiseId }),
    setFranchiseFees: (franchiseId, initialFranchiseFee, monthlyTechnologyFee, royaltyPct) =>
      dispatch({ type: 'SET_FRANCHISE_FEES', franchiseId, initialFranchiseFee, monthlyTechnologyFee, royaltyPct }),
    updateFranchiseProfile: (franchiseId, updates) => dispatch({ type: 'UPDATE_FRANCHISE_PROFILE', franchiseId, ...updates }),
    setTodaTerminalGps: (todaOrgId, gps) => dispatch({ type: 'SET_TODA_TERMINAL_GPS', todaOrgId, gps }),
    setTodaTerminalAddress: (todaOrgId, args) => dispatch({ type: 'SET_TODA_TERMINAL_ADDRESS', todaOrgId, ...args }),
    setTariffSettings: (settings) => dispatch({ type: 'SET_TARIFF_SETTINGS', settings }),
    setPabiliServiceFee: (amount) => dispatch({ type: 'SET_PABILI_SERVICE_FEE', amount }),
    addExpense: (args) => {
      const id = `expense-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_EXPENSE', id, ...args })
    },
    deleteExpense: (expenseId) => dispatch({ type: 'DELETE_EXPENSE', expenseId }),
    toggleComplianceItem: (itemId, done) => dispatch({ type: 'TOGGLE_COMPLIANCE_ITEM', itemId, done }),
    setComplianceNote: (itemId, note, deadlineAt = null) =>
      dispatch({ type: 'SET_COMPLIANCE_NOTE', itemId, note, deadlineAt }),
    addCapitalContribution: (args) => {
      const id = `capital-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_CAPITAL_CONTRIBUTION', id, ...args })
    },
    deleteCapitalContribution: (contributionId) =>
      dispatch({ type: 'DELETE_CAPITAL_CONTRIBUTION', contributionId }),
    addAccountingOfficer: (args) => {
      const id = `officer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_ACCOUNTING_OFFICER', id, otherPositionLabel: null, ...args })
    },
    removeAccountingOfficer: (officerId) => dispatch({ type: 'REMOVE_ACCOUNTING_OFFICER', officerId }),
    updateAccountingOfficer: (officerId, args) =>
      dispatch({ type: 'UPDATE_ACCOUNTING_OFFICER', officerId, otherPositionLabel: null, ...args }),
    addEquityAllocation: (args) => {
      const id = `equity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_EQUITY_ALLOCATION', id, otherCategoryLabel: null, notes: null, ...args })
    },
    updateEquityAllocation: (allocationId, args) =>
      dispatch({ type: 'UPDATE_EQUITY_ALLOCATION', allocationId, otherCategoryLabel: null, notes: null, ...args }),
    removeEquityAllocation: (allocationId) => dispatch({ type: 'REMOVE_EQUITY_ALLOCATION', allocationId }),
    addInvestor: (args) => {
      const id = `investor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({
        type: 'ADD_INVESTOR',
        id,
        preMoneyValuation: null,
        postMoneyValuation: null,
        agreementReference: null,
        notes: null,
        ...args,
      })
    },
    updateInvestor: (investorId, args) =>
      dispatch({
        type: 'UPDATE_INVESTOR',
        investorId,
        preMoneyValuation: null,
        postMoneyValuation: null,
        agreementReference: null,
        notes: null,
        ...args,
      }),
    removeInvestor: (investorId) => dispatch({ type: 'REMOVE_INVESTOR', investorId }),
    addFounderContribution: (args) => {
      const id = `founder-contrib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_FOUNDER_CONTRIBUTION', id, supportingDocDataUrl: null, ...args })
    },
    updateFounderContribution: (contributionId, args) =>
      dispatch({ type: 'UPDATE_FOUNDER_CONTRIBUTION', contributionId, supportingDocDataUrl: null, ...args }),
    setFounderContributionStatus: (contributionId, status, approvedValue, approvedBy) =>
      dispatch({ type: 'SET_FOUNDER_CONTRIBUTION_STATUS', contributionId, status, approvedValue, approvedBy }),
    removeFounderContribution: (contributionId) =>
      dispatch({ type: 'REMOVE_FOUNDER_CONTRIBUTION', contributionId }),
    setSocialImpactFundPct: (pct) => dispatch({ type: 'SET_SOCIAL_IMPACT_FUND_PCT', pct }),
    addSocialImpactTransaction: (args) => {
      const id = `sif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({
        type: 'ADD_SOCIAL_IMPACT_TRANSACTION',
        id,
        projectId: null,
        approvedBy: null,
        supportingDocDataUrl: null,
        ...args,
      })
    },
    setSocialImpactTransactionStatus: (transactionId, status, approvedBy) =>
      dispatch({ type: 'SET_SOCIAL_IMPACT_TRANSACTION_STATUS', transactionId, status, approvedBy }),
    removeSocialImpactTransaction: (transactionId) =>
      dispatch({ type: 'REMOVE_SOCIAL_IMPACT_TRANSACTION', transactionId }),
    addRotaryProject: (args) => {
      const id = `rotary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_ROTARY_PROJECT', id, startDate: null, endDate: null, ...args })
    },
    updateRotaryProject: (projectId, args) =>
      dispatch({ type: 'UPDATE_ROTARY_PROJECT', projectId, startDate: null, endDate: null, ...args }),
    removeRotaryProject: (projectId) => dispatch({ type: 'REMOVE_ROTARY_PROJECT', projectId }),
    addDistribution: (args) => {
      const id = `distribution-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_DISTRIBUTION', id, reference: null, approvedBy: null, ...args })
    },
    updateDistribution: (distributionId, args) =>
      dispatch({ type: 'UPDATE_DISTRIBUTION', distributionId, reference: null, approvedBy: null, ...args }),
    removeDistribution: (distributionId) => dispatch({ type: 'REMOVE_DISTRIBUTION', distributionId }),
    addRccIncentive: (args) => {
      const id = `rcc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_RCC_INCENTIVE', id, approvedBy: null, ...args })
    },
    updateRccIncentive: (incentiveId, args) =>
      dispatch({ type: 'UPDATE_RCC_INCENTIVE', incentiveId, approvedBy: null, ...args }),
    removeRccIncentive: (incentiveId) => dispatch({ type: 'REMOVE_RCC_INCENTIVE', incentiveId }),
    updateCorporateRegistration: (info) => dispatch({ type: 'UPDATE_CORPORATE_REGISTRATION', info }),
    addStockholder: (args) => {
      const id = `stockholder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_STOCKHOLDER', id, dateSubscribed: null, certificateNo: null, ...args })
    },
    updateStockholder: (stockholderId, args) =>
      dispatch({ type: 'UPDATE_STOCKHOLDER', stockholderId, dateSubscribed: null, certificateNo: null, ...args }),
    removeStockholder: (stockholderId) => dispatch({ type: 'REMOVE_STOCKHOLDER', stockholderId }),
    addTodaContribution: (args) => {
      const id = `todacontrib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_TODA_CONTRIBUTION', id, ...args })
    },
    deleteTodaContribution: (contributionId) => dispatch({ type: 'DELETE_TODA_CONTRIBUTION', contributionId }),
    addTodaExpense: (args) => {
      const id = `todaexpense-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_TODA_EXPENSE', id, ...args })
    },
    deleteTodaExpense: (expenseId) => dispatch({ type: 'DELETE_TODA_EXPENSE', expenseId }),
    savePassengerLocation: (passengerId, label, location) => {
      const id = `savedloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'SAVE_PASSENGER_LOCATION', passengerId, id, label, location })
    },
    removePassengerLocation: (passengerId, savedLocationId) =>
      dispatch({ type: 'REMOVE_PASSENGER_LOCATION', passengerId, savedLocationId }),
    rateRide: (args) => dispatch({ type: 'RATE_RIDE', ...args }),
    reportDriver: (args) => {
      const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'REPORT_DRIVER', id, ...args })
    },
    resolveDriverReport: (reportId) => dispatch({ type: 'RESOLVE_DRIVER_REPORT', reportId }),
    registerDriver: (args) => dispatch({ type: 'REGISTER_DRIVER', inviteId: null, ...args }),
    createDriverInvite: (args) => {
      const id = `invite-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
      dispatch({ type: 'CREATE_DRIVER_INVITE', id, ...args })
      return id
    },
    registerPassenger: (args) => {
      if (args.age < MINOR_AGE_LIMIT) return null
      const id = `pax-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'REGISTER_PASSENGER', id, ...args })
      return id
    },
    registerParentWithChild: (args) => {
      if (args.childAge >= MINOR_AGE_LIMIT) return null
      const parentId = `parent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const childId = `pax-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'REGISTER_PARENT_WITH_CHILD', parentId, childId, ...args })
      return { parentId, childId }
    },
    logActivity: (args) => {
      const id = `actlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_ACTIVITY_LOG_ENTRY', id, at: new Date().toISOString(), ...args })
    },
    addAdvertiser: (args) => {
      const id = `advertiser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_ADVERTISER', id, contactEmail: null, notes: null, ...args })
    },
    updateAdvertiser: (advertiserId, args) =>
      dispatch({ type: 'UPDATE_ADVERTISER', advertiserId, contactEmail: null, notes: null, ...args }),
    removeAdvertiser: (advertiserId) => dispatch({ type: 'REMOVE_ADVERTISER', advertiserId }),
    addCampaign: (args) => {
      const id = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({
        type: 'ADD_CAMPAIGN',
        id,
        endDate: null,
        rewardNote: null,
        dailyLimit: null,
        weeklyLimit: null,
        monthlyLimit: null,
        advertiserId: null,
        ...args,
      })
    },
    updateCampaign: (campaignId, args) =>
      dispatch({
        type: 'UPDATE_CAMPAIGN',
        campaignId,
        endDate: null,
        rewardNote: null,
        dailyLimit: null,
        weeklyLimit: null,
        monthlyLimit: null,
        advertiserId: null,
        ...args,
      }),
    setCampaignStatus: (campaignId, status) => dispatch({ type: 'SET_CAMPAIGN_STATUS', campaignId, status }),
    updateCampaignMetrics: (campaignId, args) => dispatch({ type: 'UPDATE_CAMPAIGN_METRICS', campaignId, ...args }),
    removeCampaign: (campaignId) => dispatch({ type: 'REMOVE_CAMPAIGN', campaignId }),
    addPromoOffer: (args) => {
      const id = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_PROMO_OFFER', id, code: null, endDate: null, usageLimit: null, ...args })
    },
    updatePromoOffer: (offerId, args) =>
      dispatch({ type: 'UPDATE_PROMO_OFFER', offerId, code: null, endDate: null, usageLimit: null, ...args }),
    setPromoOfferStatus: (offerId, status) => dispatch({ type: 'SET_PROMO_OFFER_STATUS', offerId, status }),
    removePromoOffer: (offerId) => dispatch({ type: 'REMOVE_PROMO_OFFER', offerId }),
    setRewardRules: (rules) => dispatch({ type: 'SET_REWARD_RULES', rules }),
    addCoinTransaction: (args) => {
      const id = `coin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_COIN_TRANSACTION', id, campaignId: null, note: null, ...args })
    },
    removeCoinTransaction: (transactionId) => dispatch({ type: 'REMOVE_COIN_TRANSACTION', transactionId }),
    addRideCreditTier: (coins, pesoValue) => {
      const id = `credit-tier-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_RIDE_CREDIT_TIER', id, coins, pesoValue })
    },
    updateRideCreditTier: (tierId, coins, pesoValue) =>
      dispatch({ type: 'UPDATE_RIDE_CREDIT_TIER', tierId, coins, pesoValue }),
    removeRideCreditTier: (tierId) => dispatch({ type: 'REMOVE_RIDE_CREDIT_TIER', tierId }),
    addReferral: (args) => {
      const id = `referral-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_REFERRAL', id, referredPassengerId: null, campaignId: null, ...args })
    },
    setReferralStatus: (referralId, status, coinsAwarded) =>
      dispatch({ type: 'SET_REFERRAL_STATUS', referralId, status, coinsAwarded }),
    removeReferral: (referralId) => dispatch({ type: 'REMOVE_REFERRAL', referralId }),
    setIncomePromotionSettings: (settings) => dispatch({ type: 'SET_INCOME_PROMOTION_SETTINGS', settings }),
    addPartnershipRevenue: (args) => {
      const id = `partnership-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_PARTNERSHIP_REVENUE', id, ...args })
    },
    removePartnershipRevenue: (entryId) => dispatch({ type: 'REMOVE_PARTNERSHIP_REVENUE', entryId }),
    setAdSenseSettings: (settings) => dispatch({ type: 'SET_ADSENSE_SETTINGS', settings }),
    createMedsOrder: (args) => dispatch({ type: 'CREATE_MEDS_ORDER', ...args }),
    sendMedsQuote: (orderId, items, receiptDataUrl) => dispatch({ type: 'PHARMACY_SEND_QUOTE', orderId, items, receiptDataUrl }),
    rejectMedsOrder: (orderId, reason) => dispatch({ type: 'PHARMACY_REJECT_MEDS_ORDER', orderId, reason }),
    reviewMedsPrescription: (orderId, approved, reason) =>
      dispatch({ type: 'REVIEW_MEDS_PRESCRIPTION', orderId, approved, reason }),
    acceptMedsQuote: (orderId, paymentMethod, paymentProofDataUrl, deliveryMode) =>
      dispatch({ type: 'CUSTOMER_ACCEPT_QUOTE', orderId, paymentMethod, paymentProofDataUrl, deliveryMode }),
    cancelMedsOrder: (orderId) => dispatch({ type: 'CANCEL_MEDS_ORDER', orderId }),
    sendMedsOrderMessage: (orderId, sender, text) => dispatch({ type: 'SEND_MEDS_ORDER_MESSAGE', orderId, sender, text }),
    processMedsOrder: (orderId) => dispatch({ type: 'PHARMACY_PROCESS_MEDS_ORDER', orderId }),
    bookOwnMedsRide: (orderId) => dispatch({ type: 'MEDS_ORDER_BOOK_OWN_RIDE', orderId }),
    toggleMedicineProductStock: (productId) => dispatch({ type: 'TOGGLE_MEDICINE_PRODUCT_STOCK', productId }),
    registerPharmacy: (args) => {
      const id = `pharm-${Date.now()}`
      dispatch({ type: 'REGISTER_PHARMACY', id, ...args })
      return id
    },
    addMedicineProduct: (args) => {
      const id = `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_MEDICINE_PRODUCT', id, ...args })
    },
    updatePharmacyPaymentAccount: (pharmacyId, method, details) =>
      dispatch({ type: 'UPDATE_PHARMACY_PAYMENT_ACCOUNT', pharmacyId, method, details }),
  }

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>
}

export function useRides() {
  const ctx = useContext(RideContext)
  if (!ctx) throw new Error('useRides must be used within a RideProvider')
  return ctx
}

export const ETA_SECONDS_PER_LEG = LEG_DURATION_MS / 1000
