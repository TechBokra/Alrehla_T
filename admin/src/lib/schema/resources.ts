import type { z } from "zod";
import type { Database } from "@/types/supabase";
import { productSchema, addonSchema } from "./catalog";
import * as people from "./people";
import * as catalog from "./catalog-settings";
import * as shipping from "./shipping";
import * as learning from "./learning";
import * as orders from "./orders";
import * as finance from "./finance";
import * as content from "./content";
import * as community from "./community";
import * as workflow from "./workflow";
import * as studio from "./studio";
import { aqlamConfigSchema, aqlamBlockedWordsSchema } from "./aqlam-config";
import { siteSettingsSchema, transferDetailsSchema } from "./settings";
import {
  activeStateSchema,
  listQuerySchema,
  recordActionSchema,
} from "./common";

/** Editable form contracts. This registry does not register or enable Refine resources. */
export const adminResourceSchemas = {
  personalized_products: productSchema,
  addon_products: addonSchema,
  user_profiles: people.userResourceCreateSchema,
  admin_roles: people.adminRoleSchema,
  instructors: people.instructorProfileSchema,
  instructor_media: people.instructorMediaSchema,
  service_providers: people.providerSchema,
  provider_services: people.providerOfferingSchema,
  customization_fields: catalog.customizationFieldSchema,
  story_goals: catalog.storyGoalSchema,
  writing_dialects: catalog.writingDialectSchema,
  price_promotions: catalog.promotionSchema,
  discount_codes: catalog.discountCodeSchema,
  shipping_rates: shipping.shippingRateSchema,
  countries: shipping.shippingCountrySchema,
  governorates: shipping.governorateSchema,
  creative_writing_packages: learning.writingPackageSchema,
  box_subscription_plans: learning.boxPlanSchema,
  standalone_services: learning.creativeServiceSchema,
  blog_posts: content.blogPostSchema,
  testimonials: content.testimonialSchema,
  ads: content.adSchema,
  site_settings: siteSettingsSchema,
  aqlam_config: aqlamConfigSchema,
  task_steps: workflow.taskStepSchema,
  pricing_formula_settings: finance.instructorPricingFormulaSchema,
} satisfies Partial<Record<keyof Database["public"]["Tables"], z.ZodTypeAny>>;

/** Commands are intentionally separate from generic create/update forms. */
export const adminActionSchemas = {
  users: {
    create: people.userResourceCreateSchema,
    update: people.userResourceUpdateSchema,
    invite: people.inviteUserSchema,
    role: people.userRoleSchema,
    resetPassword: people.resetUserPasswordSchema,
    suspend: people.userSuspensionSchema,
    delete: people.deleteUserSchema,
  },
  adminRoles: {
    save: people.adminRoleSchema,
    assign: people.assignAdminRoleSchema,
  },
  deletionRequests: { decide: people.deletionRequestDecisionSchema },
  instructors: {
    create: people.createInstructorSchema,
    profile: people.instructorProfileSchema,
    review: people.instructorReviewSchema,
    revokeMedia: people.instructorMediaRevocationSchema,
    status: people.instructorStatusSchema,
    packages: people.instructorPackagesSchema,
    certification: people.instructorCertificationSchema,
    training: people.instructorTrainingSchema,
    transfer: people.transferInstructorWorkSchema,
  },
  providers: {
    create: people.createProviderSchema,
    details: people.providerSchema,
    offering: people.providerOfferingSchema,
  },
  joinRequests: {
    decide: people.joinRequestDecisionSchema,
    message: people.joinRequestMessageSchema,
  },
  products: {
    review: catalog.productReviewSchema,
    active: activeStateSchema,
    reorder: catalog.heroProductOrderSchema,
  },
  orders: {
    fulfilment: orders.orderFulfilmentSchema,
    electronicDelivery: orders.electronicDeliverySchema,
  },
  serviceOrders: {
    close: orders.serviceOrderCloseSchema,
    decide: orders.serviceOrderDecisionSchema,
    due: orders.serviceOrderDueSchema,
    confirmPayment: recordActionSchema,
  },
  box: {
    shipment: orders.boxShipmentSchema,
    goal: orders.boxShipmentGoalSchema,
    subscription: orders.boxSubscriptionStatusSchema,
    leadDays: workflow.boxLeadDaysSchema,
  },
  bookings: {
    confirmPayment: recordActionSchema,
    assign: learning.assignBookingInstructorSchema,
    cancel: learning.cancelBookingSchema,
  },
  sessions: {
    create: learning.createSessionSchema,
    details: learning.sessionDetailsSchema,
    changeRequest: learning.sessionChangeDecisionSchema,
  },
  finance: {
    payout: finance.payoutPaidSchema,
    withdrawal: finance.withdrawalDecisionSchema,
    providerPricing: finance.pricingFormulaSchema,
    publisherPricing: finance.pricingFormulaSchema,
  },
  shipping: {
    pause: shipping.deliveryPauseSchema,
    country: shipping.shippingCountrySchema,
    governorate: shipping.governorateSchema,
    flags: shipping.governorateFlagsSchema,
    adjust: shipping.shippingAdjustmentSchema,
  },
  content: {
    page: content.pageContentSchema,
    image: content.siteImageSchema,
    deleteMedia: content.mediaDeletionSchema,
  },
  notifications: {
    broadcast: content.broadcastNotificationSchema,
    disabledTypes: content.disabledNotificationsSchema,
  },
  settings: { general: siteSettingsSchema, transfer: transferDetailsSchema },
  support: {
    reply: community.supportReplySchema,
    close: recordActionSchema,
    sessionRequest: community.supportRequestStatusSchema,
  },
  reviews: { visibility: community.reviewVisibilitySchema },
  feedback: {
    seen: recordActionSchema.extend({ seen: activeStateSchema.shape.isActive }),
  },
  aqlam: {
    post: community.aqlamPostModerationSchema,
    comment: community.aqlamCommentModerationSchema,
    report: community.aqlamReportDecisionSchema,
    sanction: community.aqlamSanctionSchema,
    guardian: community.aqlamGuardianDecisionSchema,
    settings: community.aqlamSettingsSchema,
    config: aqlamConfigSchema,
    blockedWords: aqlamBlockedWordsSchema,
    pin: community.aqlamPinSchema,
    allowlist: community.aqlamAllowlistSchema,
  },
  tasks: {
    assign: workflow.assignmentRuleSchema,
    reassign: workflow.taskReassignmentSchema,
    priority: workflow.taskPrioritySchema,
    due: workflow.taskDueSchema,
    note: workflow.taskNoteSchema,
    complete: recordActionSchema,
  },
  studio: {
    mode: studio.studioModeSchema,
    start: studio.studioStartSchema,
    assign: studio.studioAssignmentSchema,
    brief: studio.studioBriefSchema,
    consent: studio.studioPhotoConsentSchema,
    character: studio.studioCharacterSchema,
    qa: studio.studioQaSchema,
    version: studio.studioVersionSchema,
    clientDecision: studio.studioClientDecisionSchema,
    page: studio.studioPageSchema,
    reviewPage: studio.studioPageReviewSchema,
    transition: studio.studioTransitionSchema,
    cost: studio.studioCostSchema,
    stage: workflow.studioStageSchema,
    moveStage: workflow.studioStageMoveSchema,
    stageFlow: workflow.studioStageFlowSchema,
    edges: workflow.studioEdgesSchema,
    productRoute: workflow.studioProductRouteSchema,
  },
  privateFiles: { download: recordActionSchema, delete: recordActionSchema },
} satisfies Record<string, Record<string, z.ZodTypeAny>>;

/** Common list inputs for read views; resource-specific filters belong to their feature. */
export const adminReadSchemas = {
  dashboard: listQuerySchema,
  publishers: listQuerySchema,
  auditLogs: listQuerySchema,
  rooms: listQuerySchema,
  media: listQuerySchema,
  feedback: listQuerySchema,
  orders: listQuerySchema,
  privateFiles: listQuerySchema,
};
export type AdminResourceName = keyof typeof adminResourceSchemas;
export type AdminResourceFormInput<TResource extends AdminResourceName> =
  z.input<(typeof adminResourceSchemas)[TResource]>;
export type AdminResourceFormValues<TResource extends AdminResourceName> =
  z.output<(typeof adminResourceSchemas)[TResource]>;
export type AdminActionResource = keyof typeof adminActionSchemas;
export type AdminActionName<TResource extends AdminActionResource> =
  keyof (typeof adminActionSchemas)[TResource];
type ActionSchema<
  TResource extends AdminActionResource,
  TAction extends AdminActionName<TResource>,
> = Extract<(typeof adminActionSchemas)[TResource][TAction], z.ZodTypeAny>;
export type AdminActionInput<
  TResource extends AdminActionResource,
  TAction extends AdminActionName<TResource>,
> = z.input<ActionSchema<TResource, TAction>>;
export type AdminActionValues<
  TResource extends AdminActionResource,
  TAction extends AdminActionName<TResource>,
> = z.output<ActionSchema<TResource, TAction>>;
