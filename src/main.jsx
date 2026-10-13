import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import { demoCreators } from "./demoCreators";
import {
  Search, BarChart3, Bookmark, Bell, Menu, ChevronDown,
  Handshake, ShieldCheck, Store, UserRound, X, ArrowRight,
  MessageCircle, Send, CheckCircle2, LogOut, LayoutDashboard, ExternalLink,
  Star, MapPin, Users, Instagram, Youtube, LoaderCircle, MessagesSquare,
  Plus, Megaphone
} from "lucide-react";
import "./styles.css";
import "./workflow.css";
import "./ui.css";
import "./demo-creators.css";

const niches = ["All Niches","Technology","Food","Travel","Fashion","Gaming","Education","Fitness","Finance","Lifestyle","Comedy","Beauty","Business","Other"];
const budgets = ["Any Budget","Under ₹1K","₹1K–₹5K","₹5K–₹10K","₹10K–₹25K","₹25K+"];
const publicNavItems = [
  { label: "Home", href: "#home" },
  { label: "Discover Opportunities", href: "#opportunities" },
  { label: "For Business Owners", href: "#business" },
  { label: "For Creators", href: "#creators" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Login", href: "#login" },
  { label: "Get Started", href: "#signup" }
];
const businessDashboardNav = [
  { label: "Overview", section: "dashboard" },
  { label: "My Business Profile", section: "business-profile" },
  { label: "My Promotion Listings", section: "promotion-listings" },
  { label: "Creator Offers", section: "offers" },
  { label: "Collaborations", section: "collaborations" },
  { label: "Messages", section: "messages" },
  { label: "Settings", section: "business-settings" }
];
const creatorDashboardNav = [
  { label: "Overview", section: "dashboard" },
  { label: "Creator Profile", section: "creator-profile" },
  { label: "Discover Opportunities", section: "opportunities" },
  { label: "Saved Opportunities", section: "saved-opportunities" },
  { label: "My Offers", section: "offers" },
  { label: "Collaborations", section: "collaborations" },
  { label: "Messages", section: "messages" },
  { label: "Settings", disabled: true }
];
const PAGE_SIZE = 12;
const CREATOR_FETCH_SIZE = 500;
const PROFILE_IMAGE_BUCKET = "creatorconnect-profile-images";
const PROFILE_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function ImageFileInputs({ name, label, multiple = false }){
  return <div className="profileImageInputs">
    <span>{label} <span className="optionalField">(optional; uploaded images are publicly viewable)</span></span>
    <div>
      <label className="profileImagePicker">Take photo<input name={name} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"/></label>
      <label className="profileImagePicker">Choose from gallery or files<input name={name} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple}/></label>
    </div>
  </div>;
}

async function uploadProfileImage(file, userId, folder){
  if (!(file instanceof File) || !file.size) return null;
  if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > PROFILE_IMAGE_MAX_SIZE) {
    throw new Error("Each image must be 5 MB or smaller.");
  }
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.slice("image/".length);
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PROFILE_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });
  if (error) {
    console.error("Unable to upload profile image to Supabase Storage:", error);
    throw new Error("Image upload failed. Apply supabase/migrations/20261013000000_profile_image_storage.sql and check the Storage permissions.");
  }
  return supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function BrandMark({ onClick }){
  return <a className="brand" href="#home" aria-label="CreatorConnect home" onClick={onClick}>
    <span className="brandIcon"><Youtube aria-hidden="true"/></span>
    <span>Creator<span>Connect</span></span>
  </a>;
}

function creatorProfileErrorMessage(error){
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code)) {
    return "Creator profiles are not set up yet. Apply supabase/migrations/20261012030000_creator_profiles_and_discovery.sql and supabase/migrations/20261012060000_creator_discovery_profiles.sql in Supabase.";
  }
  if (error?.code === "42501") {
    return "Supabase denied access to this creator profile. Confirm that you are signed in with a Creator account and apply the creator profile migration.";
  }
  return "We couldn't load your creator profile. Check your connection and try again.";
}

function opportunityErrorMessage(error){
  if (["42883", "42P01", "42703", "PGRST202", "PGRST205"].includes(error?.code)) {
    return "Opportunity discovery is not set up yet. Apply supabase/migrations/20261012030000_creator_profiles_and_discovery.sql in Supabase, then reload.";
  }
  return "We couldn't load published opportunities. Check your connection and try again.";
}

function collaborationErrorMessage(error){
  if (["42883", "42P01", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(error?.code)) {
    return "Collaboration management is not set up yet. Apply supabase/migrations/20261012050000_collaboration_management.sql after the offer migration.";
  }
  if (error?.code === "42501") {
    return "Supabase denied access to this collaboration. Sign in as one of its participants and check the collaboration migration.";
  }
  return "We couldn't load collaborations. Check your connection and try again.";
}

function PublicNavigation({ navOpen, onNavigate }){
  return <nav className={navOpen ? "navOpen" : ""} aria-label="Main navigation">
    {publicNavItems.map(item => (
      <a
        key={item.label}
        className={item.label === "Home" ? "active" : ""}
        aria-current={item.label === "Home" ? "page" : undefined}
        href={item.href}
        onClick={event => onNavigate(event, item.label, item.href)}
      >
        {item.label}
      </a>
    ))}
  </nav>;
}

function DashboardNavigation({ role, activeItem, onNavigate }){
  const items = role === "business_owner" ? businessDashboardNav : creatorDashboardNav;
  return <nav className="dashboardNav" aria-label={role === "business_owner" ? "Business dashboard" : "Creator dashboard"}>
    {items.map(item => (
      <button
        type="button"
        key={item.label}
        className={`dashboardNavItem ${activeItem === item.label ? "selected" : ""}`}
        disabled={item.disabled}
        title={item.disabled ? "Available in a future phase" : undefined}
        aria-current={activeItem === item.label ? "page" : undefined}
        onClick={() => onNavigate(item)}
      >
        {item.label}
      </button>
    ))}
  </nav>;
}

function WorkflowSteps(){
  const steps = [
    { icon: <Store aria-hidden="true"/>, title: "Publish opportunities", detail: "Businesses share a promotion" },
    { icon: <Search aria-hidden="true"/>, title: "Discover opportunities", detail: "Creators find the right fit" },
    { icon: <MessagesSquare aria-hidden="true"/>, title: "Negotiate together", detail: "Agree on scope and budget" },
    { icon: <Youtube aria-hidden="true"/>, title: "Promote and grow", detail: "Content goes live" }
  ];

  return <ol className="workflowSteps" aria-label="How CreatorConnect works">
    {steps.map((step, index) => (
      <li className="workflowStep" key={step.title}>
        <span className="workflowStepIcon">{step.icon}</span>
        <span className="workflowStepNumber">0{index + 1}</span>
        <strong>{step.title}</strong>
        <span className="workflowStepDetail">{step.detail}</span>
      </li>
    ))}
  </ol>;
}

function creatorQueryErrorMessage(error){
  const code = error?.code;
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") {
    return "Creator discovery is not set up yet. Apply supabase/migrations/20261012060000_creator_discovery_profiles.sql in the Supabase SQL Editor, then reload CreatorConnect.";
  }
  if (code === "42501") return "Sign in to discover registered creator profiles.";
  return "We couldn't load creator opportunities. Check your Supabase connection and try again.";
}

const businessProfileColumns = "id,owner_id,business_name,owner_name,category,description,city,state,address,contact_email,contact_phone,logo_url,photo_urls,website_url,social_links,opening_hours,is_public,created_at,updated_at";
const promotionListingColumns = "id,business_id,title,description,product_service,promotion_type,budget_min,budget_max,pricing_mode,preferred_niche,subscriber_count,subscriber_requirement,city,location,deliverables,preferred_date,deadline,status,created_at,updated_at";
const creatorProfileColumns = "user_id,full_name,channel_name,channel_url,subscriber_count,average_views,niche,city,state,location,biography,profile_image_url,promotion_interests,preferred_promotion_types,minimum_fee,availability,preferred_travel_distance_km,created_at,updated_at";
const promotionTypes = [
  "YouTube Shorts",
  "Dedicated video",
  "Product review",
  "Restaurant visit",
  "Shop tour",
  "Event coverage"
];
const creatorPromotionTypes = promotionTypes;
const budgetRanges = [
  { label: "Any budget", min: null, max: null },
  { label: "Under ₹5,000", min: null, max: 4999.99 },
  { label: "₹5,000–₹10,000", min: 5000, max: 9999.99 },
  { label: "₹10,000–₹25,000", min: 10000, max: 24999.99 },
  { label: "₹25,000+", min: 25000, max: null }
];

function businessProfileErrorMessage(error){
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code)) {
    return "The businesses table is missing or out of date. Apply supabase/migrations/20261012010000_business_profiles.sql in the Supabase SQL Editor, then reload.";
  }
  if (error?.code === "42501") {
    return "Supabase denied access to this business profile. Confirm the business profile migration and owner role are set up correctly.";
  }
  return "We couldn't load your business profile. Check your connection and try again.";
}

function promotionListingErrorMessage(error){
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code)) {
    return "Promotion listings are not set up yet. Apply supabase/migrations/20261012020000_promotion_listings.sql in the Supabase SQL Editor, then reload.";
  }
  if (error?.code === "42501") {
    return "Supabase denied access to these listings. Confirm the migration was applied and that this business profile belongs to your account.";
  }
  return "We couldn't load your promotion listings. Check your connection and try again.";
}

function validOptionalUrl(value){
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function money(n){ return "₹" + n.toLocaleString("en-IN"); }
function currentLocalDate(){
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function formatSubscribers(n){
  if (n >= 1000000) return `${Number((n / 1000000).toFixed(1))}M`;
  if (n >= 1000) return `${Number((n / 1000).toFixed(1))}K`;
  return String(n);
}

function mapCreator(row){
  const name = row.full_name || row.creator_name || row.channel_name || "Creator";
  const artwork = creatorCardArtwork(name);
  const profileImage = row.profile_image_url || row.profile_image || null;
  const subscriberCount = Number(row.subscriber_count ?? row.subscribers ?? 0);
  const averageViews = row.average_views == null ? null : Number(row.average_views);
  const id = row.id || row.user_id;
  return {
    id,
    userId: row.user_id,
    name,
    channelName: row.channel_name,
    niche: row.niche,
    city: row.city,
    subscriberCount,
    averageViews,
    engagement: Number(row.engagement ?? (subscriberCount && averageViews != null ? averageViews / subscriberCount * 100 : 0)),
    budget: row.minimum_fee ?? row.starting_price ?? null,
    image: profileImage || artwork.cover,
    avatar: profileImage || artwork.avatar,
    channelUrl: row.channel_url,
    bio: row.biography || row.description || "",
    state: row.state || "",
    platform: row.platform || "YouTube",
    availability: row.availability || "available",
    isDemo: false,
    isRegisteredProfile: id === row.user_id && Boolean(row.user_id),
    verified: row.is_verified === true,
    audience: row.audience || {},
    workSamples: Array.isArray(row.work_samples) ? row.work_samples : [],
    contentCategories: Array.isArray(row.content_categories) ? row.content_categories : [],
    pricing: {
      shortVideo: row.short_video_price,
      longVideo: row.long_video_price,
      productPromotion: row.product_promotion_price,
      dedicatedVideo: row.dedicated_video_price
    }
  };
}

function creatorMatchesSearch(creator, query){
  if (!creator) return false;
  if (!query) return true;
  const searchableText = `${creator.name} ${creator.channelName || ""} ${creator.niche || ""} ${creator.city || ""} ${creator.state || ""} ${creator.bio || ""}`.toLowerCase();
  return searchableText.includes(query.toLocaleLowerCase());
}

function creatorCardArtwork(name){
  const initials = String(name || "Creator").trim().split(/\s+/).slice(0, 2)
    .map(part => part.charAt(0)).join("").toUpperCase()
    .replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
  const avatar = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ede5ff"/><stop offset="1" stop-color="#cdbaff"/></linearGradient></defs><rect width="240" height="240" rx="120" fill="url(#g)"/><text x="120" y="135" text-anchor="middle" font-family="Arial,sans-serif" font-size="76" font-weight="700" fill="#512bbd">${initials}</text></svg>`)}`;
  const cover = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#f5f0ff"/><stop offset="1" stop-color="#d9caff"/></linearGradient></defs><rect width="800" height="360" fill="url(#g)"/><circle cx="650" cy="40" r="150" fill="#7651c9" opacity=".16"/><circle cx="160" cy="330" r="190" fill="#fff" opacity=".4"/></svg>');
  return { avatar, cover };
}

function OpportunityCard({ opportunity, saved, saving, canSave, onSave, onOffer, offerDisabled = false, offerLabel = "Make an offer" }){
  const budgetLabel = opportunity.budget_min != null && opportunity.budget_max != null
    ? `${money(Number(opportunity.budget_min))}–${money(Number(opportunity.budget_max))}`
    : opportunity.budget_min != null
      ? `From ${money(Number(opportunity.budget_min))}`
      : `Up to ${money(Number(opportunity.budget_max))}`;
  return <article className="opportunityCard">
    <div className="opportunityCardHeading">
      <div className="opportunityBusiness">
        {opportunity.business_logo_url
          ? <img src={opportunity.business_logo_url} alt="" loading="lazy"/>
          : <span aria-hidden="true"><Store/></span>}
        <div><strong>{opportunity.business_name}</strong><small>{opportunity.business_category}</small></div>
      </div>
      {canSave && <button className={saved ? "outline savedOpportunityButton" : "primary savedOpportunityButton"} type="button" disabled={saving} aria-pressed={saved} onClick={()=>onSave(opportunity)}>
        <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"}/>{saving ? "Saving…" : saved ? "Saved" : "Save"}
      </button>}
    </div>
    <h3>{opportunity.title}</h3>
    <p className="opportunityProduct">{opportunity.promotion_type} · {opportunity.product_service}</p>
    <p className="opportunityDescription">{opportunity.description}</p>
    <div className="opportunityFacts">
      <span><strong>Budget</strong>{budgetLabel} · {opportunity.pricing_mode}</span>
      <span><strong>Location</strong>{opportunity.location}, {opportunity.city}</span>
      <span><strong>Creator niche</strong>{opportunity.preferred_niche}</span>
      <span><strong>Subscribers</strong>{opportunity.subscriber_count == null ? "No minimum" : `${Number(opportunity.subscriber_count).toLocaleString("en-IN")} ${opportunity.subscriber_requirement}`}</span>
      <span><strong>Preferred date</strong>{new Date(`${opportunity.preferred_date}T00:00:00`).toLocaleDateString()}</span>
      {opportunity.deadline && <span><strong>Deadline</strong>{new Date(`${opportunity.deadline}T00:00:00`).toLocaleDateString()}</span>}
    </div>
    <details className="opportunityMoreDetails">
      <summary>View deliverables and full details</summary>
      <p><strong>Description</strong>{opportunity.description}</p>
      <p><strong>Deliverables</strong>{opportunity.deliverables}</p>
      <p><strong>Posted</strong>{new Date(opportunity.created_at).toLocaleDateString()}</p>
    </details>
    {canSave && <button type="button" className="primary makeOfferButton" disabled={offerDisabled} onClick={()=>onOffer?.(opportunity)}><Send aria-hidden="true"/> {offerLabel}</button>}
  </article>;
}

function CreatorOfferCard({ offer, role, busy, counterOpen, onAction, onCounterToggle, onCounterSubmit, counterError }){
  const creator = offer.creatorProfile;
  return <article className="creatorOfferCard">
    <header className="creatorOfferHeader">
      <div><span className={`promotionStatus promotionStatus-${offer.status === "accepted" ? "published" : offer.status === "rejected" || offer.status === "withdrawn" ? "closed" : "paused"}`}>{offer.status.replaceAll("_", " ")}</span>
        <h4>{offer.listing_title}</h4><p>{role === "business_owner" ? `Offer from ${creator?.channel_name || creator?.full_name || "Creator"}` : offer.business_name}</p>
      </div>
      <strong className="creatorOfferPrice">{money(Number(offer.proposed_price))}</strong>
    </header>
    {role === "business_owner" && creator && <details className="offeredCreatorProfile"><summary>Review creator profile</summary>
      <div className="offeredCreatorProfileBody"><h5>{creator.channel_name}</h5><p>{creator.full_name} · {creator.niche} · {creator.location}, {creator.city}</p>
        <a href={creator.channel_url} target="_blank" rel="noreferrer">Open YouTube channel <ExternalLink aria-hidden="true"/></a>
        <p><strong>Subscribers:</strong> {Number(creator.subscriber_count).toLocaleString("en-IN")}{creator.average_views != null ? ` · Average views: ${Number(creator.average_views).toLocaleString("en-IN")}` : ""}</p>
        {creator.biography && <p>{creator.biography}</p>}
        {creator.promotion_interests?.length > 0 && <p><strong>Interests:</strong> {creator.promotion_interests.join(", ")}</p>}
        {creator.preferred_promotion_types?.length > 0 && <p><strong>Preferred types:</strong> {creator.preferred_promotion_types.join(", ")}</p>}
        {creator.minimum_fee != null && <p><strong>Minimum fee:</strong> {money(Number(creator.minimum_fee))}</p>}
        <p><strong>Availability:</strong> {creator.availability}{creator.preferred_travel_distance_km != null ? ` · Travel preference ${creator.preferred_travel_distance_km} km` : ""}</p>
      </div>
    </details>}
    <div className="creatorOfferTerms">
      <p><strong>Message</strong>{offer.message}</p>
      <p><strong>Proposed deliverables</strong>{offer.proposed_deliverables}</p>
      {offer.proposed_schedule && <p><strong>Proposed schedule</strong>{offer.proposed_schedule}</p>}
    </div>
    <p className="creatorOfferTimestamp">Last updated {new Date(offer.updated_at).toLocaleString()}</p>
    {offer.status === "accepted" && <p className="offerAgreementNotice" role="status">Both parties accepted these price and terms. This agreement does not automatically create or confirm a collaboration.</p>}
    {offer.history?.length > 0 && <details className="offerHistory"><summary>Negotiation history ({offer.history.length})</summary>
      <ol>{offer.history.map(entry=><li key={entry.id}><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.actor_role === "creator" ? "Creator" : "Business owner"} · {new Date(entry.created_at).toLocaleString()}</small></div>
        <b>{money(Number(entry.proposed_price))}</b><p>{entry.message}</p><p><strong>Deliverables:</strong> {entry.proposed_deliverables}</p>{entry.proposed_schedule && <p><strong>Schedule:</strong> {entry.proposed_schedule}</p>}
      </li>)}</ol>
    </details>}
    {role === "business_owner" && offer.status === "pending_business" && <div className="offerActions">
      <button type="button" className="primary" disabled={busy} onClick={()=>onAction(offer, "accept")}>Accept offer</button>
      <button type="button" className="outline" disabled={busy} onClick={()=>onAction(offer, "reject")}>Reject</button>
      <button type="button" className="outline" disabled={busy} onClick={()=>onCounterToggle(offer.id)}>{counterOpen ? "Cancel counteroffer" : "Counteroffer"}</button>
    </div>}
    {role === "creator" && offer.status === "pending_business" && <div className="offerActions"><button type="button" className="outline" disabled={busy} onClick={()=>onAction(offer, "withdraw")}>Withdraw pending offer</button></div>}
    {role === "creator" && offer.status === "pending_creator" && <div className="offerActions">
      <button type="button" className="primary" disabled={busy} onClick={()=>onAction(offer, "accept")}>Accept counteroffer</button>
      <button type="button" className="outline" disabled={busy} onClick={()=>onAction(offer, "reject")}>Reject counteroffer</button>
    </div>}
    {counterOpen && role === "business_owner" && offer.status === "pending_business" && <form className="counterOfferForm" onSubmit={event=>onCounterSubmit(event, offer)}>
      <h5>Send a counteroffer</h5>
      <div className="promotionFormGrid">
        <label>Counter price (₹)<input name="counter_price" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={offer.proposed_price} required/></label>
        <label>Schedule (optional)<input name="counter_schedule" maxLength="1000" defaultValue={offer.proposed_schedule || ""}/></label>
        <label className="promotionFormWide">Message<textarea name="counter_message" maxLength="4000" required defaultValue="Thank you for your offer. I would like to propose the following terms."/></label>
        <label className="promotionFormWide">Proposed deliverables<textarea name="counter_deliverables" maxLength="4000" required defaultValue={offer.proposed_deliverables}/></label>
      </div>
      {counterError && <p className="businessError" role="alert">{counterError}</p>}
      <div className="businessFormActions"><button type="submit" className="primary" disabled={busy}>{busy ? "Sending…" : "Send counteroffer"}</button></div>
    </form>}
  </article>;
}

function CreatorCollaborationCard({
  collaboration, role, agreedDate, busy, onDateChange, onConfirm, onStatus, onOpenMessages
}){
  const isBusiness = role === "business_owner";
  const canMessage = ["confirmed", "in_progress", "completed", "disputed"].includes(collaboration.status);
  const canUpdateStatus = ["awaiting_confirmation", "confirmed", "in_progress", "disputed"].includes(collaboration.status);
  return <article className="managedCollaborationCard">
    <header className="managedCollaborationHeader">
      <div>
        <span className={`collaborationStatus collaborationStatus-${collaboration.status}`}>{collaboration.status.replaceAll("_", " ")}</span>
        <h4>{collaboration.listing_title}</h4>
        <p>{isBusiness ? collaboration.creator_name : collaboration.business_name}</p>
      </div>
      <strong>{money(Number(collaboration.agreed_price))}</strong>
    </header>
    <div className="managedCollaborationDetails">
      <p><strong>Business</strong>{collaboration.business_name}</p>
      <p><strong>Creator</strong>{collaboration.creator_name}</p>
      <p><strong>Agreed deliverables</strong>{collaboration.deliverables}</p>
      <p><strong>Agreed campaign date</strong>{collaboration.agreed_date
        ? new Date(`${collaboration.agreed_date}T00:00:00`).toLocaleDateString()
        : "Not scheduled"}</p>
      {collaboration.confirmed_at && <p><strong>Confirmed</strong>{new Date(collaboration.confirmed_at).toLocaleString()}</p>}
    </div>
    {collaboration.status === "awaiting_confirmation" && <div className="collaborationConfirmation">
      <p>Both participants must confirm the agreed date and terms before the campaign is confirmed.</p>
      <p className="collaborationConfirmations">
        Business {collaboration.business_confirmed_at
          ? `confirmed ${new Date(collaboration.business_confirmed_at).toLocaleString()}`
          : "awaiting confirmation"}
        {" · "}
        Creator {collaboration.creator_confirmed_at
          ? `confirmed ${new Date(collaboration.creator_confirmed_at).toLocaleString()}`
          : "awaiting confirmation"}
      </p>
      <label>Agreed campaign date <span className="optionalField">(optional)</span>
        <input type="date" min={new Date().toISOString().slice(0, 10)} value={agreedDate ?? collaboration.agreed_date ?? ""}
          onChange={event=>onDateChange(collaboration.id, event.target.value)}/>
      </label>
      <button type="button" className="primary" disabled={busy}
        onClick={()=>onConfirm(collaboration, agreedDate ?? collaboration.agreed_date ?? "")}>
        {busy ? "Saving confirmation…" : isBusiness
          ? collaboration.business_confirmed_at ? "Update my confirmation" : "Confirm collaboration"
          : collaboration.creator_confirmed_at ? "Update my confirmation" : "Confirm collaboration"}
      </button>
    </div>}
    <div className="managedCollaborationActions">
      {canMessage && <button type="button" className="outline" onClick={()=>onOpenMessages(collaboration)}><MessageCircle/> Messages</button>}
      {canUpdateStatus && <>
        {collaboration.status === "confirmed" && <button type="button" className="outline" disabled={busy} onClick={()=>onStatus(collaboration, "in_progress")}>Start campaign</button>}
        {(collaboration.status === "in_progress" || collaboration.status === "disputed") && <button type="button" className="primary" disabled={busy} onClick={()=>onStatus(collaboration, "completed")}>Mark completed</button>}
        {collaboration.status === "disputed" && <button type="button" className="outline" disabled={busy} onClick={()=>onStatus(collaboration, "in_progress")}>Resume campaign</button>}
        {collaboration.status !== "disputed" && <button type="button" className="outline" disabled={busy} onClick={()=>onStatus(collaboration, "disputed")}>Report an issue</button>}
        <button type="button" className="outline" disabled={busy} onClick={()=>onStatus(collaboration, "cancelled")}>Cancel</button>
      </>}
    </div>
  </article>;
}

function App(){
  const [opportunitySearch,setOpportunitySearch] = useState("");
  const [debouncedOpportunitySearch,setDebouncedOpportunitySearch] = useState("");
  const [opportunityCategory,setOpportunityCategory] = useState("");
  const [opportunityCity,setOpportunityCity] = useState("");
  const [opportunityBudget,setOpportunityBudget] = useState("Any budget");
  const [opportunityNegotiable,setOpportunityNegotiable] = useState(false);
  const [opportunityType,setOpportunityType] = useState("");
  const [opportunitySubscriberRequirement,setOpportunitySubscriberRequirement] = useState("");
  const [opportunitySort,setOpportunitySort] = useState("recent");
  const [opportunityPage,setOpportunityPage] = useState(0);
  const [opportunities,setOpportunities] = useState([]);
  const [opportunityCount,setOpportunityCount] = useState(0);
  const [opportunitiesLoading,setOpportunitiesLoading] = useState(false);
  const [opportunitiesError,setOpportunitiesError] = useState("");
  const [creatorSavedOpportunityIds,setCreatorSavedOpportunityIds] = useState([]);
  const [savedOpportunities,setSavedOpportunities] = useState([]);
  const [savedOpportunitiesLoading,setSavedOpportunitiesLoading] = useState(false);
  const [savedOpportunitiesError,setSavedOpportunitiesError] = useState("");
  const [savingOpportunityId,setSavingOpportunityId] = useState("");
  const [creatorProfileLoading,setCreatorProfileLoading] = useState(false);
  const [creatorProfileSaving,setCreatorProfileSaving] = useState(false);
  const [creatorProfileEditing,setCreatorProfileEditing] = useState(false);
  const [creatorProfileError,setCreatorProfileError] = useState("");
  const [creatorProfileSaveError,setCreatorProfileSaveError] = useState("");
  const [creatorProfileSaveSuccess,setCreatorProfileSaveSuccess] = useState(false);
  const [creatorOffers,setCreatorOffers] = useState([]);
  const [offersLoading,setOffersLoading] = useState(false);
  const [offersReload,setOffersReload] = useState(0);
  const [offersError,setOffersError] = useState("");
  const [offerListing,setOfferListing] = useState(null);
  const [offerSubmitError,setOfferSubmitError] = useState("");
  const [offerSubmitting,setOfferSubmitting] = useState(false);
  const [offerActionBusy,setOfferActionBusy] = useState("");
  const [offerActionError,setOfferActionError] = useState("");
  const [counterOfferId,setCounterOfferId] = useState("");
  const [counterOfferError,setCounterOfferError] = useState("");
  const [query,setQuery] = useState("");
  const [debouncedQuery,setDebouncedQuery] = useState("");
  const [sort,setSort] = useState("Recently Joined");
  const [page,setPage] = useState(0);
  const [creatorCount,setCreatorCount] = useState(0);
  const [creatorsLoading,setCreatorsLoading] = useState(true);
  const [navOpen,setNavOpen] = useState(false);
  const [selected,setSelected] = useState(null);
  const [profileReviews,setProfileReviews] = useState([]);
  const [profileTab,setProfileTab] = useState("Overview");
  const [role,setRole] = useState(null);
  const [creatorList,setCreatorList] = useState([]);
  const [creatorLoadError,setCreatorLoadError] = useState("");
  const [creatorProfileRequests,setCreatorProfileRequests] = useState([]);
  const [creatorProfileRequestsError,setCreatorProfileRequestsError] = useState("");
  const [requestSubmitError,setRequestSubmitError] = useState("");
  const [session,setSession] = useState(null);
  const [accountProfile,setAccountProfile] = useState(null);
  const [creatorProfile,setCreatorProfile] = useState(null);
  const [shopProfile,setShopProfile] = useState(null);
  const [businessProfile,setBusinessProfile] = useState(null);
  const [businessLoading,setBusinessLoading] = useState(false);
  const [businessLoadError,setBusinessLoadError] = useState("");
  const [businessSaving,setBusinessSaving] = useState(false);
  const [businessSaveError,setBusinessSaveError] = useState("");
  const [businessEditing,setBusinessEditing] = useState(false);
  const [businessSaveSuccess,setBusinessSaveSuccess] = useState(false);
  const [promotionListings,setPromotionListings] = useState([]);
  const [listingsLoading,setListingsLoading] = useState(false);
  const [listingsLoadError,setListingsLoadError] = useState("");
  const [listingEditing,setListingEditing] = useState(false);
  const [listingSaving,setListingSaving] = useState(false);
  const [listingSaveError,setListingSaveError] = useState("");
  const [listingSaveSuccess,setListingSaveSuccess] = useState(false);
  const [listingStatusUpdating,setListingStatusUpdating] = useState("");
  const [listingStatusError,setListingStatusError] = useState("");
  const [editingListing,setEditingListing] = useState(null);
  const [requests,setRequests] = useState([]);
  const [requestCreator,setRequestCreator] = useState(null);
  const [dashboard,setDashboard] = useState(false);
  const [activeDashboardItem,setActiveDashboardItem] = useState("Overview");
  const [dashboardDestination,setDashboardDestination] = useState("");
  const [savedCreatorIds,setSavedCreatorIds] = useState([]);
  const [savingCreatorId,setSavingCreatorId] = useState(null);
  const [notifications,setNotifications] = useState([]);
  const [notificationsLoading,setNotificationsLoading] = useState(false);
  const [notificationsError,setNotificationsError] = useState("");
  const [showNotifications,setShowNotifications] = useState(false);
  const [creatorCollaborations,setCreatorCollaborations] = useState([]);
  const [collaborationsLoading,setCollaborationsLoading] = useState(false);
  const [collaborationsError,setCollaborationsError] = useState("");
  const [collaborationsReload,setCollaborationsReload] = useState(0);
  const [collaborationActionBusy,setCollaborationActionBusy] = useState("");
  const [collaborationDateDrafts,setCollaborationDateDrafts] = useState({});
  const [activeCreatorCollaboration,setActiveCreatorCollaboration] = useState(null);
  const [creatorConversationId,setCreatorConversationId] = useState("");
  const [creatorCollaborationMessages,setCreatorCollaborationMessages] = useState([]);
  const [creatorMessagesLoading,setCreatorMessagesLoading] = useState(false);
  const [creatorMessagesError,setCreatorMessagesError] = useState("");
  const [creatorMessageDraft,setCreatorMessageDraft] = useState("");
  const [creatorMessageSending,setCreatorMessageSending] = useState(false);
  const [activeChat,setActiveChat] = useState(null);
  const [messages,setMessages] = useState([]);
  const [messageDraft,setMessageDraft] = useState("");
  const [messagesLoading,setMessagesLoading] = useState(false);
  const [messagesError,setMessagesError] = useState("");
  const [registrationRole,setRegistrationRole] = useState("creator");
  const [maxBudget,setMaxBudget] = useState(100000);
  const [maxSubscribers,setMaxSubscribers] = useState(50000000);
  const [sessionReady,setSessionReady] = useState(false);
  const [profileLoading,setProfileLoading] = useState(false);
  const [profileLoadError,setProfileLoadError] = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [authError,setAuthError] = useState("");
  const [authNotice,setAuthNotice] = useState("");
  const [authEmail,setAuthEmail] = useState("");
  const [toast,setToast] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [session?.user?.id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedOpportunitySearch(opportunitySearch.trim());
      setOpportunityPage(0);
    }, 250);
    return () => clearTimeout(timeout);
  }, [opportunitySearch]);

  useEffect(() => {
    if (!dashboardDestination) return;
    const section = document.getElementById(dashboardDestination);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    setDashboardDestination("");
  }, [dashboard, dashboardDestination]);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError("We couldn't restore your session. Please log in again.");
        showToast("We couldn't restore your session. Please log in again.");
      }
      setSession(data.session);
      setSessionReady(true);
    }).catch(() => {
      if (active) {
        setSessionReady(true);
        showToast("Unable to restore your session. Please log in again.");
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setAuthError("");
        setAuthNotice("");
        setRole("reset-password");
      }
      if (event === "SIGNED_OUT") {
        setAccountProfile(null);
        setCreatorProfile(null);
        setShopProfile(null);
        setDashboard(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadProfile(){
      if (!session?.user) {
        setAccountProfile(null);
        setCreatorProfile(null);
        setShopProfile(null);
        setRequests([]);
        setActiveCreatorCollaboration(null);
        setCreatorConversationId("");
        setCreatorCollaborationMessages([]);
        setCreatorMessageDraft("");
        setProfileLoadError("");
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      setProfileLoadError("");
      try {
        const { data, error } = await supabase.from("profiles")
          .select("id,email,full_name,phone,role,created_at")
          .eq("id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        if (!data) {
          setAccountProfile(null);
          setProfileLoadError("No readable CreatorConnect profile was found for this account. Run supabase/migrations/20261012000000_auth_profiles.sql in Supabase. It safely restores existing accounts with a valid saved role; otherwise check the account's role metadata and the profiles RLS policy.");
          console.warn("No readable CreatorConnect profile was returned for the authenticated user.");
          return;
        }
        setAccountProfile(data);
        setCreatorProfile(null);
        setShopProfile(null);
        setDashboard(true);
      } catch (error) {
        if (!active) return;
        setAccountProfile(null);
        setProfileLoadError(error?.code === "42P01" || error?.code === "PGRST205"
          ? "The authentication profile table is missing. Apply supabase/migrations/20261012000000_auth_profiles.sql in the Supabase SQL Editor."
          : "We couldn't load your account profile. Check the authentication schema and try again.");
        console.error("Unable to load the authenticated profile:", error);
      } finally {
        if (active) setProfileLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    let active = true;
    async function loadBusinessProfile(){
      if (!session?.user || accountProfile?.role !== "business_owner") {
        setBusinessProfile(null);
        setBusinessLoadError("");
        setBusinessLoading(false);
        return;
      }
      setBusinessLoading(true);
      setBusinessLoadError("");
      try {
        const { data, error } = await supabase.from("businesses")
          .select(businessProfileColumns)
          .eq("owner_id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (active) setBusinessProfile(data || null);
      } catch (error) {
        if (!active) return;
        setBusinessProfile(null);
        setBusinessLoadError(businessProfileErrorMessage(error));
        console.error("Unable to load the owner's business profile:", error);
      } finally {
        if (active) setBusinessLoading(false);
      }
    }
    loadBusinessProfile();
    return () => { active = false; };
  }, [session?.user?.id, accountProfile?.role]);

  useEffect(() => {
    let active = true;
    async function loadCreatorProfile(){
      if (!session?.user || accountProfile?.role !== "creator") {
        setCreatorProfile(null);
        setCreatorProfileError("");
        setCreatorProfileLoading(false);
        setCreatorProfileEditing(false);
        return;
      }
      if (!supabase) {
        setCreatorProfile(null);
        setCreatorProfileError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
        setCreatorProfileLoading(false);
        return;
      }
      setCreatorProfileLoading(true);
      setCreatorProfileError("");
      try {
        const { data, error } = await supabase.from("creator_profiles")
          .select(creatorProfileColumns)
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (active) setCreatorProfile(data || null);
      } catch (error) {
        if (!active) return;
        setCreatorProfile(null);
        setCreatorProfileError(creatorProfileErrorMessage(error));
        console.error("Unable to load the creator's profile:", error);
      } finally {
        if (active) setCreatorProfileLoading(false);
      }
    }
    loadCreatorProfile();
    return () => { active = false; };
  }, [session?.user?.id, accountProfile?.role]);

  useEffect(() => {
    let active = true;
    async function loadOpportunities(){
      if (!supabase) {
        setOpportunities([]);
        setOpportunityCount(0);
        setOpportunitiesError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
        setOpportunitiesLoading(false);
        return;
      }
      setOpportunitiesLoading(true);
      setOpportunitiesError("");
      const selectedBudget = budgetRanges.find(range => range.label === opportunityBudget) || budgetRanges[0];
      try {
        const { data, error } = await supabase.rpc("discover_promotion_listings", {
          p_search: debouncedOpportunitySearch || null,
          p_category: opportunityCategory.trim() || null,
          p_city: opportunityCity.trim() || null,
          p_budget_min: selectedBudget.min,
          p_budget_max: selectedBudget.max,
          p_negotiable_only: opportunityNegotiable,
          p_promotion_type: opportunityType || null,
          p_subscriber_requirement: opportunitySubscriberRequirement || null,
          p_sort: opportunitySort,
          p_limit: PAGE_SIZE,
          p_offset: opportunityPage * PAGE_SIZE
        });
        if (error) throw error;
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setOpportunities(items);
        setOpportunityCount(Number(data?.total_count) || 0);
      } catch (error) {
        if (!active) return;
        setOpportunities([]);
        setOpportunityCount(0);
        setOpportunitiesError(opportunityErrorMessage(error));
        console.error("Unable to discover promotion opportunities:", error);
      } finally {
        if (active) setOpportunitiesLoading(false);
      }
    }
    loadOpportunities();
    return () => { active = false; };
  }, [
    debouncedOpportunitySearch, opportunityCategory, opportunityCity, opportunityBudget,
    opportunityNegotiable, opportunityType, opportunitySubscriberRequirement, opportunitySort,
    opportunityPage, creatorProfile?.niche, creatorProfile?.city,
    creatorProfile?.minimum_fee, creatorProfile?.subscriber_count
  ]);

  useEffect(() => {
    let active = true;
    async function loadPromotionListings(){
      if (!session?.user || accountProfile?.role !== "business_owner" || !businessProfile?.id) {
        setPromotionListings([]);
        setListingsLoadError("");
        setListingsLoading(false);
        return;
      }
      setListingsLoading(true);
      setListingsLoadError("");
      try {
        const { data, error } = await supabase.from("promotion_listings")
          .select(promotionListingColumns)
          .eq("business_id", businessProfile.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setPromotionListings(data || []);
      } catch (error) {
        if (!active) return;
        setPromotionListings([]);
        setListingsLoadError(promotionListingErrorMessage(error));
        console.error("Unable to load the business's promotion listings:", error);
      } finally {
        if (active) setListingsLoading(false);
      }
    }
    loadPromotionListings();
    return () => { active = false; };
  }, [session?.user?.id, accountProfile?.role, businessProfile?.id]);

  useEffect(() => {
    let active = true;
    async function loadCreatorOffers(){
      if (!session?.user || !accountProfile?.role
        || (accountProfile.role === "business_owner" && (businessLoading || listingsLoading))) {
        setCreatorOffers([]);
        setOffersError("");
        setOffersLoading(false);
        return;
      }
      if (accountProfile.role === "business_owner" && !businessProfile?.id) {
        setCreatorOffers([]);
        setOffersError("");
        setOffersLoading(false);
        return;
      }
      if (!supabase) {
        setOffersError("Supabase is not configured. Check your project settings and try again.");
        setOffersLoading(false);
        return;
      }
      setOffersLoading(true);
      setOffersError("");
      try {
        const columns = "id,promotion_listing_id,creator_user_id,listing_title,business_name,proposed_price,message,proposed_deliverables,proposed_schedule,status,counteroffer_count,created_at,updated_at";
        let query = supabase.from("creator_offers").select(columns);
        if (accountProfile.role === "creator") {
          query = query.eq("creator_user_id", session.user.id);
        } else {
          const listingIds = promotionListings.map(listing => listing.id);
          if (!listingIds.length) {
            if (active) setCreatorOffers([]);
            return;
          }
          query = query.in("promotion_listing_id", listingIds);
        }
        const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        const offerRows = data || [];
        if (!active) return;
        if (!offerRows.length) {
          setCreatorOffers([]);
          return;
        }
        const offerIds = offerRows.map(offer => offer.id);
        const creatorIds = [...new Set(offerRows.map(offer => offer.creator_user_id))];
        const [historyResult, creatorResult] = await Promise.all([
          supabase.from("creator_offer_history")
            .select("id,offer_id,actor_user_id,actor_role,action,proposed_price,message,proposed_deliverables,proposed_schedule,created_at")
            .in("offer_id", offerIds)
            .order("created_at", { ascending: true })
            .limit(500),
          accountProfile.role === "business_owner"
            ? supabase.from("creator_profiles")
              .select("user_id,full_name,channel_name,channel_url,subscriber_count,average_views,niche,city,location,biography,promotion_interests,preferred_promotion_types,minimum_fee,availability,preferred_travel_distance_km")
              .in("user_id", creatorIds)
            : Promise.resolve({ data: [], error: null })
        ]);
        if (historyResult.error) throw historyResult.error;
        if (creatorResult.error) throw creatorResult.error;
        if (!active) return;
        const historyByOffer = new Map();
        for (const entry of historyResult.data || []) {
          const list = historyByOffer.get(entry.offer_id) || [];
          list.push(entry);
          historyByOffer.set(entry.offer_id, list);
        }
        const creatorById = new Map((creatorResult.data || []).map(profile => [profile.user_id, profile]));
        setCreatorOffers(offerRows.map(offer => ({
          ...offer,
          history: historyByOffer.get(offer.id) || [],
          creatorProfile: creatorById.get(offer.creator_user_id) || null
        })));
      } catch (error) {
        if (!active) return;
        setCreatorOffers([]);
        setOffersError(error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST204"
          ? "Offers are not set up yet. Apply supabase/migrations/20261012040000_creator_offers.sql in Supabase."
          : "We couldn't load offers. Check the offer migration and your account access, then try again.");
        console.error("Unable to load creator offers:", error);
      } finally {
        if (active) setOffersLoading(false);
      }
    }
    loadCreatorOffers();
    return () => { active = false; };
  }, [
    session?.user?.id, accountProfile?.role, businessProfile?.id, businessLoading,
    listingsLoading, promotionListings, offersReload
  ]);

  useEffect(() => {
    let active = true;
    async function loadCreatorCollaborations(){
      if (!session?.user || !["creator", "business_owner"].includes(accountProfile?.role)) {
        setCreatorCollaborations([]);
        setCollaborationsError("");
        setCollaborationsLoading(false);
        return;
      }
      if (!supabase) {
        setCreatorCollaborations([]);
        setCollaborationsError("Supabase is not configured. Check your project settings and try again.");
        setCollaborationsLoading(false);
        return;
      }
      setCollaborationsLoading(true);
      setCollaborationsError("");
      try {
        const { data, error } = await supabase.from("creator_collaborations")
          .select("id,offer_id,business_id,business_user_id,creator_user_id,promotion_listing_id,business_name,creator_name,listing_title,agreed_price,deliverables,agreed_date,status,business_confirmed_at,creator_confirmed_at,confirmed_at,created_at,updated_at")
          .order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        if (active) setCreatorCollaborations(data || []);
      } catch (error) {
        if (!active) return;
        setCreatorCollaborations([]);
        setCollaborationsError(collaborationErrorMessage(error));
        console.error("Unable to load offer-based collaborations:", error);
      } finally {
        if (active) setCollaborationsLoading(false);
      }
    }
    loadCreatorCollaborations();
    return () => { active = false; };
  }, [session?.user?.id, accountProfile?.role, collaborationsReload]);

  useEffect(() => {
    let active = true;
    async function loadCreators(){
      if (!supabase) {
        setCreatorList([]);
        setCreatorLoadError("Supabase is not configured. Copy creatorconnect-vscode/.env.example to creatorconnect-vscode/.env.local, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart Vite.");
        setCreatorsLoading(false);
        return;
      }
      if (!session?.user?.id) {
        setCreatorList([]);
        setCreatorCount(0);
        setCreatorLoadError("");
        setCreatorsLoading(false);
        return;
      }
      setCreatorsLoading(true);
      setCreatorLoadError("");
      let ownProfileRow = null;
      let ownProfileLoadError = null;
      try {
        if (accountProfile?.role === "creator") {
          const ownProfileResult = await supabase.from("creator_profiles")
            .select(creatorProfileColumns)
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (ownProfileResult.error) {
            ownProfileLoadError = ownProfileResult.error;
            console.error("Unable to load the signed-in creator's profile for discovery:", ownProfileResult.error);
          } else {
            ownProfileRow = ownProfileResult.data;
          }
        }
        let request = supabase.from("public_creator_profiles")
          .select("id,user_id,full_name,channel_name,channel_url,subscriber_count,average_views,niche,city,state,biography,profile_image_url,minimum_fee,availability,platform,engagement,created_at", { count: "exact" });
        if (debouncedQuery) {
          const safeQuery = debouncedQuery.replace(/[(),]/g, " ").trim();
          if (safeQuery) request = request.or(`full_name.ilike.%${safeQuery}%,channel_name.ilike.%${safeQuery}%,niche.ilike.%${safeQuery}%,biography.ilike.%${safeQuery}%,city.ilike.%${safeQuery}%,state.ilike.%${safeQuery}%`);
        }
        const orderBy = sort === "Lowest Price" ? "starting_price"
          : sort === "Highest Engagement" ? "engagement"
          : sort === "Most Subscribers" ? "subscriber_count"
          : sort === "Best Match" ? "engagement"
          : "created_at";
        const actualOrderBy = orderBy === "starting_price" ? "minimum_fee" : orderBy;
        const allRows = [];
        let count = 0;
        let offset = 0;
        while (true) {
          const { data, error, count: resultCount } = await request
            .order(actualOrderBy, { ascending: sort === "Lowest Price", nullsFirst: false })
            .order("id", { ascending: true })
            .range(offset, offset + CREATOR_FETCH_SIZE - 1);
          if (error) throw error;
          allRows.push(...(data || []));
          count = resultCount ?? count;
          if (!data?.length || (resultCount != null && allRows.length >= resultCount)
            || (resultCount == null && data.length < CREATOR_FETCH_SIZE)) break;
          offset += data.length;
        }
        if (!active) return;
        const creatorsFromView = allRows.map(mapCreator);
        const ownProfileRecord = ownProfileRow
          || (creatorProfile?.user_id === session.user.id ? creatorProfile : null);
        const ownProfile = accountProfile?.role === "creator" && ownProfileRecord
          ? mapCreator(ownProfileRecord)
          : null;
        const ownProfileMatchesSearch = creatorMatchesSearch(ownProfile, debouncedQuery);
        const creators = [
          ...(ownProfileMatchesSearch ? [ownProfile] : []),
          ...creatorsFromView.filter(creator => creator.userId !== ownProfile?.userId)
        ];
        setCreatorList(creators);
        setCreatorCount(Math.max(count, creators.length));
        if (ownProfileLoadError) setCreatorLoadError(creatorProfileErrorMessage(ownProfileLoadError));
      } catch (error) {
        if (!active) return;
        const ownProfileRecord = ownProfileRow
          || (creatorProfile?.user_id === session.user.id ? creatorProfile : null);
        const ownProfile = accountProfile?.role === "creator" && ownProfileRecord
          ? mapCreator(ownProfileRecord)
          : null;
        const ownProfileMatchesSearch = creatorMatchesSearch(ownProfile, debouncedQuery);
        setCreatorList(ownProfileMatchesSearch ? [ownProfile] : []);
        setCreatorCount(ownProfileMatchesSearch ? 1 : 0);
        setCreatorLoadError(creatorQueryErrorMessage(error));
        console.error("Unable to load creators from Supabase:", error);
        showToast("Unable to load creator opportunities. See the message below.");
      } finally {
        if (active) setCreatorsLoading(false);
      }
    }
    loadCreators();
    return () => { active = false; };
  }, [session?.user?.id, accountProfile?.role, creatorProfile?.updated_at, sort, debouncedQuery]);

  const filteredDemoCreators = useMemo(() => {
    const searchTerm = debouncedQuery.toLowerCase();
    const matches = demoCreators.filter(creator => {
      const searchableText = `${creator.name} ${creator.channelName} ${creator.niche} ${creator.city} ${creator.bio}`.toLowerCase();
      return !searchTerm || searchableText.includes(searchTerm);
    });
    if (sort === "Lowest Price") return matches.sort((a, b) => a.budget - b.budget);
    if (sort === "Highest Engagement" || sort === "Best Match") return matches.sort((a, b) => b.engagement - a.engagement);
    if (sort === "Most Subscribers") return matches.sort((a, b) => b.subscriberCount - a.subscriberCount);
    return matches;
  }, [debouncedQuery, sort]);
  const ownRegisteredCreator = accountProfile?.role === "creator"
    ? creatorList.find(creator => creator.userId === session?.user?.id)
      || (creatorProfile?.user_id === session?.user?.id ? mapCreator(creatorProfile) : null)
    : null;
  const ownCreatorMatchesSearch = creatorMatchesSearch(ownRegisteredCreator, debouncedQuery);
  const otherRegisteredCreators = new Map(creatorList
    .filter(creator => creator.userId !== ownRegisteredCreator?.userId)
    .map(creator => [creator.userId || creator.id, creator]));
  const registeredCreators = [
    ...(ownCreatorMatchesSearch ? [ownRegisteredCreator] : []),
    ...otherRegisteredCreators.values()
  ];
  const registeredCreatorKeys = new Set(registeredCreators.flatMap(creator => [creator.name, creator.channelName, creator.channelUrl])
    .map(name => String(name || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean));
  const uniqueDemoCreators = filteredDemoCreators.filter(creator => ![creator.name, creator.channelName, creator.channelUrl]
      .some(name => registeredCreatorKeys.has(String(name || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, ""))))
  const visibleCreatorList = registeredCreators.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const filtered = [...(page === 0 ? uniqueDemoCreators : []), ...visibleCreatorList];
  const registeredCreatorCount = Math.max(creatorCount, registeredCreators.length);
  const matchedCreatorCount = registeredCreatorCount + uniqueDemoCreators.length;
  const unreadNotifications = notifications.filter(notification => !notification.read_at).length;

  const activeRegistrationRole = role === "signup"
    ? registrationRole
    : role === "creator" ? "creator" : "business_owner";
  const isEditingProfile = Boolean(session && accountProfile && ["creator", "business_owner"].includes(role));

  async function refreshRequests(){
    if (!supabase || !accountProfile?.id) {
      setRequests([]);
      return;
    }
    let requestQuery = supabase.from("collaborations").select("*").order("created_at", { ascending: false });
    if (accountProfile.role === "business_owner") {
      requestQuery = requestQuery.eq("business_owner_id", accountProfile.id);
    } else if (accountProfile.role === "creator") {
      const creatorId = creatorProfile?.id || (await supabase.from("creators").select("id").eq("user_id", accountProfile.id).maybeSingle()).data?.id;
      if (!creatorId) {
        setRequests([]);
        return;
      }
      requestQuery = requestQuery.eq("creator_id", creatorId);
    } else {
      setRequests([]);
      return;
    }
    const { data, error } = await requestQuery;
    if (error) throw error;
    if (!data?.length) {
      setRequests([]);
      return;
    }
    const creatorIds = [...new Set(data.map(request => request.creator_id))];
    const ownerIds = [...new Set(data.map(request => request.business_owner_id))];
    const [creatorResult, businessResult] = await Promise.all([
      supabase.from("creators").select("*").in("id", creatorIds),
      supabase.from("business_owners").select("user_id,business_name").in("user_id", ownerIds)
    ]);
    if (creatorResult.error) throw creatorResult.error;
    if (businessResult.error) throw businessResult.error;
    const creatorRows = creatorResult.data;
    const shops = businessResult.data;
    const creatorById = new Map((creatorRows || []).map(row => [row.id, mapCreator(row)]));
    const shopById = new Map((shops || []).map(row => [row.user_id, row]));
    setRequests(data.map(request => ({
      ...request,
      creator: creatorById.get(request.creator_id),
      shopOwner: shopById.get(request.business_owner_id)?.business_name || "Business owner"
    })));
  }

  useEffect(() => {
    refreshRequests().catch(() => {
      setRequests([]);
      showToast("Unable to load collaboration requests. Please try again.");
    });
  }, [accountProfile?.id, creatorProfile?.id]);

  useEffect(() => {
    let active = true;
    async function loadCreatorProfileRequests(){
      if (!supabase || !accountProfile?.id || !["creator", "business_owner"].includes(accountProfile.role)) {
        setCreatorProfileRequests([]);
        setCreatorProfileRequestsError("");
        return;
      }
      try {
        const { data, error } = await supabase.from("creator_collaboration_requests")
          .select("id,business_user_id,creator_user_id,business_name,creator_name,proposed_budget,message,status,created_at,responded_at")
          .order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        if (active) {
          setCreatorProfileRequests(data || []);
          setCreatorProfileRequestsError("");
        }
      } catch (error) {
        if (!active) return;
        setCreatorProfileRequests([]);
        setCreatorProfileRequestsError(error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST204"
          ? "Registered-profile collaboration requests are not set up. Apply supabase/migrations/20261012070000_creator_profile_requests.sql."
          : "We couldn't load registered-profile collaboration requests. Check your access and try again.");
        console.error("Unable to load registered-profile collaboration requests:", error);
      }
    }
    loadCreatorProfileRequests();
    return () => { active = false; };
  }, [accountProfile?.id, accountProfile?.role]);

  useEffect(() => {
    let active = true;
    async function loadPrivateLists() {
      if (!supabase || !accountProfile?.id) {
        setSavedCreatorIds([]);
        setNotifications([]);
        setNotificationsError("");
        setNotificationsLoading(false);
        return;
      }
      setNotificationsLoading(true);
      setNotificationsError("");
      try {
        const savedResult = accountProfile.role === "business_owner"
          ? await supabase.from("saved_creators").select("creator_id").eq("business_owner_id", accountProfile.id)
          : { data: [], error: null };
        if (savedResult.error) throw savedResult.error;
        if (!active) return;
        setSavedCreatorIds((savedResult.data || []).map(row => row.creator_id));
      } catch (error) {
        if (!active) return;
        setSavedCreatorIds([]);
        console.error("Unable to load saved creators:", error);
        showToast("Unable to load your saved creators.");
      }
      try {
        const upcomingResult = await supabase.rpc("notify_upcoming_creator_collaborations");
        if (upcomingResult.error) throw upcomingResult.error;
        const notificationResult = await supabase.from("notifications")
          .select("id,type,title,body,collaboration_id,offer_id,reference_id,conversation_id,read_at,created_at")
          .eq("user_id", accountProfile.id).order("created_at", { ascending: false }).limit(30);
        if (notificationResult.error) throw notificationResult.error;
        if (!active) return;
        setNotifications(notificationResult.data || []);
      } catch (error) {
        if (!active) return;
        setNotifications([]);
        setNotificationsError(error?.code === "42883" || error?.code === "PGRST202"
          ? "Persistent notifications are not set up yet. Apply supabase/migrations/20261012050000_collaboration_management.sql in Supabase."
          : "We couldn't load your notifications. Check your connection and try again.");
        console.error("Unable to load persistent notifications:", error);
        if (error?.code !== "42883" && error?.code !== "PGRST202") {
          showToast("Unable to load your notifications.");
        }
      } finally {
        if (active) setNotificationsLoading(false);
      }
    }
    loadPrivateLists();
    return () => { active = false; };
  }, [accountProfile?.id, accountProfile?.role]);

  useEffect(() => {
    let active = true;
    async function loadSavedOpportunities(){
      if (!session?.user || accountProfile?.role !== "creator") {
        setCreatorSavedOpportunityIds([]);
        setSavedOpportunities([]);
        setSavedOpportunitiesError("");
        setSavedOpportunitiesLoading(false);
        return;
      }
      if (!supabase) {
        setCreatorSavedOpportunityIds([]);
        setSavedOpportunities([]);
        setSavedOpportunitiesError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
        setSavedOpportunitiesLoading(false);
        return;
      }
      setSavedOpportunitiesLoading(true);
      setSavedOpportunitiesError("");
      try {
        const { data: savedRows, error: savedError } = await supabase.from("saved_opportunities")
          .select("promotion_listing_id")
          .eq("creator_user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(200);
        if (savedError) throw savedError;
        const ids = (savedRows || []).map(row => row.promotion_listing_id);
        if (!active) return;
        setCreatorSavedOpportunityIds(ids);
        if (!ids.length) {
          setSavedOpportunities([]);
          return;
        }
        const { data, error } = await supabase.from("published_promotion_listings")
          .select("*")
          .in("id", ids)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setSavedOpportunities(data || []);
      } catch (error) {
        if (!active) return;
        setCreatorSavedOpportunityIds([]);
        setSavedOpportunities([]);
        setSavedOpportunitiesError(opportunityErrorMessage(error));
        console.error("Unable to load saved opportunities:", error);
      } finally {
        if (active) setSavedOpportunitiesLoading(false);
      }
    }
    loadSavedOpportunities();
    return () => { active = false; };
  }, [session?.user?.id, accountProfile?.role]);

  useEffect(() => {
    let active = true;
    async function loadConversation() {
      if (!activeChat || !supabase) {
        setMessages([]);
        return;
      }
      setMessagesLoading(true);
      setMessagesError("");
      try {
        const { data, error } = await supabase.from("messages")
          .select("id,collaboration_id,sender_id,body,read_at,created_at")
          .eq("collaboration_id", activeChat.id).order("created_at", { ascending: true });
        if (error) throw error;
        if (!active) return;
        setMessages(data || []);
        const unreadIds = (data || []).filter(item => item.sender_id !== accountProfile.id && !item.read_at).map(item => item.id);
        if (unreadIds.length) {
          const { error: updateError } = await supabase.from("messages")
            .update({ read_at: new Date().toISOString() }).in("id", unreadIds);
          if (updateError) throw updateError;
        }
      } catch (error) {
        if (!active) return;
        console.error("Unable to load collaboration messages:", error);
        setMessagesError("We couldn't load messages. Please try again.");
      } finally {
        if (active) setMessagesLoading(false);
      }
    }
    loadConversation();
    return () => { active = false; };
  }, [activeChat?.id, accountProfile?.id]);

  useEffect(() => {
    let active = true;
    async function loadCreatorCollaborationConversation(){
      if (!activeCreatorCollaboration || !supabase) {
        setCreatorConversationId("");
        setCreatorCollaborationMessages([]);
        setCreatorMessagesError("");
        setCreatorMessagesLoading(false);
        return;
      }
      setCreatorMessagesLoading(true);
      setCreatorMessagesError("");
      try {
        const { data: conversation, error: conversationError } = await supabase
          .from("creator_collaboration_conversations").select("id")
          .eq("collaboration_id", activeCreatorCollaboration.id).maybeSingle();
        if (conversationError) throw conversationError;
        if (!conversation) throw new Error("Collaboration conversation is unavailable.");
        const { data, error } = await supabase.from("creator_collaboration_messages")
          .select("id,conversation_id,sender_id,body,created_at")
          .eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(500);
        if (error) throw error;
        if (!active) return;
        setCreatorConversationId(conversation.id);
        setCreatorCollaborationMessages(data || []);
      } catch (error) {
        if (!active) return;
        setCreatorConversationId("");
        setCreatorCollaborationMessages([]);
        setCreatorMessagesError(error?.code === "42P01" || error?.code === "PGRST205"
          ? "Collaboration messaging is not set up yet. Apply the collaboration management migration."
          : error?.code === "42501"
            ? "You do not have access to this conversation."
            : "We couldn't load this conversation. Please try again.");
        console.error("Unable to load offer-based collaboration messages:", error);
      } finally {
        if (active) setCreatorMessagesLoading(false);
      }
    }
    loadCreatorCollaborationConversation();
    return () => { active = false; };
  }, [activeCreatorCollaboration?.id, collaborationsReload]);

  useEffect(() => {
    if (selected && !selected.isDemo && selected.userId && supabase) {
      supabase.from("reviews").select("reviewee_id,rating,review,created_at")
        .eq("reviewee_id", selected.userId).order("created_at", { ascending: false }).limit(8)
        .then(({ data, error }) => {
          if (error) {
            console.error("Unable to load creator reviews:", error);
            setProfileReviews([]);
            return;
          }
          setProfileReviews(data || []);
        });
    } else {
      setProfileReviews([]);
    }
    setProfileTab("Overview");
  }, [selected?.id]);

  useEffect(() => {
    if (dashboard) document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
  }, [dashboard]);

  async function handleAuthSubmit(event){
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    if (!supabase) {
      setAuthError("Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY variables to creatorconnect-vscode/.env.local.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (role !== "login" && password.length < 8) {
      setAuthError("Choose a password with at least 8 characters.");
      return;
    }
    if (role === "login" && password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (role === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setRole(null);
        setAuthEmail("");
        showToast("You're signed in.");
        return;
      }
      const signupRole = role === "signup" ? String(form.get("account_role") || "") : role === "creator" ? "creator" : "business_owner";
      const fullName = String(form.get("full_name") || "").trim();
      if (!fullName || !["creator", "business_owner"].includes(signupRole)) {
        setAuthError("Please complete all required fields.");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: signupRole,
            full_name: fullName,
            phone: String(form.get("phone") || "").trim()
          },
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      setAuthEmail(email);
      if (data.session) {
        setRole(null);
        showToast("Your account is ready.");
      } else {
        setRole("check-email");
      }
    } catch (error) {
      const code = error?.code || "";
      const message = String(error?.message || "").toLowerCase();
      if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) setAuthError("Invalid email or password.");
      else if (code.includes("user_not_found") || message.includes("user not found")) setAuthError("Account not found. Check your email or create an account.");
      else if (code.includes("already_registered") || code.includes("user_already_exists") || code.includes("email_exists") || message.includes("already registered") || message.includes("already been registered")) setAuthError("Email already registered. Try logging in instead.");
      else if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) setAuthError("Please verify your email using the link we sent before logging in.");
      else if (code.includes("weak_password") || message.includes("password should be at least") || message.includes("password is too weak")) setAuthError("Password too weak. Choose a stronger password.");
      else if (message.includes("valid creatorconnect account type") || message.includes("creatorconnect account type") || message.includes("profile details are required") || message.includes("database error saving new user")) setAuthError("Supabase could not finish account setup. Apply the CreatorConnect authentication SQL migration, then try again. If it is already applied, check the Supabase Auth logs.");
      else if (error instanceof TypeError || message.includes("fetch") || message.includes("network")) setAuthError("Network error. Check your connection and try again.");
      else setAuthError("Unable to complete authentication. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(event){
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    if (!supabase) {
      setAuthError("Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY variables to creatorconnect-vscode/.env.local.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?auth=recovery`
      });
      if (error) throw error;
      setAuthEmail(email);
      setRole("reset-email-sent");
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      setAuthError(error instanceof TypeError || message.includes("network")
        ? "We couldn't reach Supabase. Check your connection and try again."
        : "We couldn't send a password reset email. Check the address and your Supabase email settings, then try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(event){
    event.preventDefault();
    setAuthError("");
    if (!supabase) {
      setAuthError("Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY variables to creatorconnect-vscode/.env.local.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("password_confirmation") || "");
    if (password.length < 8) {
      setAuthError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setAuthError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.history.replaceState({}, document.title, window.location.pathname);
      setRole(null);
      setAuthEmail("");
      showToast("Your password has been updated.");
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      setAuthError(message.includes("session") || message.includes("token")
        ? "This password reset link is invalid or expired. Request a new reset email."
        : "We couldn't update your password. Request a new reset email and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerificationEmail(){
    if (!supabase || !authEmail) return;
    setSubmitting(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: authEmail });
      if (error) throw error;
      setAuthNotice("A new verification email has been sent.");
    } catch {
      setAuthError("We couldn't resend the verification email. Check your Supabase email settings and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveBusinessProfile(event){
    event.preventDefault();
    setBusinessSaveError("");
    setBusinessSaveSuccess(false);
    if (!supabase || !session?.user || accountProfile?.role !== "business_owner") {
      setBusinessSaveError("Sign in with a Business Owner account to save a business profile.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const photoUrls = String(form.get("photo_urls") || "")
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean);
    const logoFile = form.getAll("business_logo_file").find(file => file instanceof File && file.size);
    const photoFiles = form.getAll("business_photo_files").filter(file => file instanceof File && file.size);
    if (photoFiles.length > 5) {
      setBusinessSaveError("Choose up to five business photos at a time.");
      return;
    }
    const socialLinks = {
      instagram: String(form.get("instagram_url") || "").trim(),
      facebook: String(form.get("facebook_url") || "").trim(),
      youtube: String(form.get("youtube_url") || "").trim(),
      tiktok: String(form.get("tiktok_url") || "").trim()
    };
    const urls = [
      String(form.get("logo_url") || ""),
      String(form.get("website_url") || ""),
      ...photoUrls,
      ...Object.values(socialLinks)
    ];
    if (urls.some(url => !validOptionalUrl(url))) {
      setBusinessSaveError("Enter a valid website link beginning with http:// or https://. Check the logo, photos, website, and social links.");
      return;
    }
    const businessName = String(form.get("business_name") || "").trim();
    const ownerName = String(form.get("owner_name") || "").trim();
    const category = String(form.get("category") || "").trim();
    const city = String(form.get("city") || "").trim();
    const state = String(form.get("state") || "").trim();
    if (!businessName || !ownerName || !category || !city || !state) {
      setBusinessSaveError("Complete the business name, owner name, category, city, and state.");
      return;
    }
    setBusinessSaving(true);
    try {
      const logoUrl = logoFile
        ? await uploadProfileImage(logoFile, session.user.id, "business")
        : String(form.get("logo_url") || "").trim() || null;
      const uploadedPhotoUrls = await Promise.all(photoFiles.map(file =>
        uploadProfileImage(file, session.user.id, "business")
      ));
      const record = {
        owner_id: session.user.id,
        business_name: businessName,
        owner_name: ownerName,
        category,
        description: String(form.get("description") || "").trim(),
        city,
        state,
        address: String(form.get("address") || "").trim() || null,
        contact_email: String(form.get("contact_email") || "").trim() || null,
        contact_phone: String(form.get("contact_phone") || "").trim() || null,
        logo_url: logoUrl,
        photo_urls: [...photoUrls, ...uploadedPhotoUrls],
        website_url: String(form.get("website_url") || "").trim() || null,
        social_links: Object.fromEntries(Object.entries(socialLinks).filter(([, url]) => url)),
        opening_hours: String(form.get("opening_hours") || "").trim() || null,
        is_public: form.get("is_public") === "on"
      };
      const { data, error } = await supabase.from("businesses")
        .upsert(record, { onConflict: "owner_id" })
        .select(businessProfileColumns)
        .single();
      if (error) throw error;
      setBusinessProfile(data);
      setBusinessEditing(false);
      setBusinessSaveSuccess(true);
      showToast("Business profile saved.");
    } catch (error) {
      console.error("Unable to save the owner's business profile:", error);
      setBusinessSaveError(error?.message === "Choose a JPEG, PNG, or WebP image."
        || error?.message === "Each image must be 5 MB or smaller."
        || error?.message?.startsWith("Image upload failed.")
        ? error.message
        : error?.code === "42P01" || error?.code === "PGRST205"
        || error?.code === "42703" || error?.code === "PGRST204"
        ? "The businesses table is missing or out of date. Apply supabase/migrations/20261012010000_business_profiles.sql, then try again."
        : error?.code === "42501"
          ? "Supabase denied this change. Confirm that you are signed in with a Business Owner account and apply the business profile migration."
          : "We couldn't save your business profile. Check the required fields and try again.");
    } finally {
      setBusinessSaving(false);
    }
  }

  async function saveCreatorProfile(event){
    event.preventDefault();
    setCreatorProfileSaveError("");
    setCreatorProfileSaveSuccess(false);
    if (!supabase || accountProfile?.role !== "creator" || !session?.user?.id) {
      setCreatorProfileSaveError("Sign in with a Creator account to manage your creator profile.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("creator_full_name") || "").trim();
    const channelName = String(form.get("channel_name") || "").trim();
    const channelUrl = String(form.get("channel_url") || "").trim();
    const nicheValue = String(form.get("creator_niche") || "").trim();
    const cityValue = String(form.get("creator_city") || "").trim();
    const stateValue = String(form.get("creator_state") || "").trim();
    const locationValue = String(form.get("creator_location") || "").trim();
    const profileImageValue = String(form.get("profile_image_url") || "").trim();
    const profileImageFile = form.getAll("creator_profile_image_file").find(file => file instanceof File && file.size);
    const biography = String(form.get("biography") || "").trim();
    const subscriberValue = String(form.get("subscriber_count") || "").trim();
    const averageViewsValue = String(form.get("average_views") || "").trim();
    const feeValue = String(form.get("minimum_fee") || "").trim();
    const travelValue = String(form.get("preferred_travel_distance_km") || "").trim();
    const availabilityValue = String(form.get("creator_availability") || "");
    let channel;
    try {
      channel = new URL(channelUrl);
    } catch {
      channel = null;
    }
    const isYoutubeUrl = channel && (channel.protocol === "https:" || channel.protocol === "http:")
      && (channel.hostname === "youtube.com" || channel.hostname.endsWith(".youtube.com") || channel.hostname === "youtu.be");
    let profileImage;
    try {
      profileImage = profileImageValue ? new URL(profileImageValue) : null;
    } catch {
      profileImage = null;
    }
    const isValidProfileImage = profileImageFile || !profileImageValue || (profileImage
      && (profileImage.protocol === "https:" || profileImage.protocol === "http:"));
    const subscriberCount = Number(subscriberValue);
    const averageViews = averageViewsValue === "" ? null : Number(averageViewsValue);
    const minimumFee = feeValue === "" ? null : Number(feeValue);
    const travelDistance = travelValue === "" ? null : Number(travelValue);
    const promotionInterests = form.getAll("promotion_interests").map(value => String(value));
    const preferredPromotionTypes = form.getAll("preferred_promotion_types").map(value => String(value));
    if (!fullName || !channelName || channelName.length > 120 || !isYoutubeUrl
      || !Number.isSafeInteger(subscriberCount) || subscriberCount < 0
      || (averageViews !== null && (!Number.isSafeInteger(averageViews) || averageViews < 0))
      || !nicheValue || !cityValue || !stateValue || stateValue.length > 100 || !locationValue
      || !isValidProfileImage || !["available", "busy", "unavailable"].includes(availabilityValue)
      || promotionInterests.some(value => !niches.slice(1).includes(value))
      || preferredPromotionTypes.some(value => !creatorPromotionTypes.includes(value))) {
      setCreatorProfileSaveError("Check the required profile details, YouTube channel URL, counts, and selected options.");
      return;
    }
    if ((minimumFee !== null && (!Number.isFinite(minimumFee) || minimumFee < 0 || minimumFee > 9999999999.99))
      || (travelDistance !== null && (!Number.isSafeInteger(travelDistance) || travelDistance < 0 || travelDistance > 10000))) {
      setCreatorProfileSaveError("Enter a valid non-negative minimum fee and a travel distance up to 10,000 km.");
      return;
    }
    setCreatorProfileSaving(true);
    try {
      const uploadedProfileImage = profileImageFile
        ? await uploadProfileImage(profileImageFile, session.user.id, "creator")
        : null;
      const record = {
        user_id: session.user.id,
        full_name: fullName,
        channel_name: channelName,
        channel_url: channel.href,
        subscriber_count: subscriberCount,
        average_views: averageViews,
        niche: nicheValue,
        city: cityValue,
        state: stateValue,
        location: locationValue,
        biography,
        profile_image_url: uploadedProfileImage || profileImage?.href || null,
        promotion_interests: promotionInterests,
        preferred_promotion_types: preferredPromotionTypes,
        minimum_fee: minimumFee,
        availability: availabilityValue,
        preferred_travel_distance_km: travelDistance
      };
      const { data, error } = await supabase.from("creator_profiles")
        .upsert(record, { onConflict: "user_id" })
        .select(creatorProfileColumns)
        .single();
      if (error) throw error;
      setCreatorProfile(data);
      setCreatorProfileEditing(false);
      setCreatorProfileSaveSuccess(true);
      showToast("Creator profile saved.");
    } catch (error) {
      console.error("Unable to save the creator profile:", error);
      setCreatorProfileSaveError(error?.message === "Choose a JPEG, PNG, or WebP image."
        || error?.message === "Each image must be 5 MB or smaller."
        || error?.message?.startsWith("Image upload failed.")
        ? error.message
        : error?.code === "42703" || error?.code === "PGRST204"
        ? "Creator profile fields are out of date. Apply supabase/migrations/20261012060000_creator_discovery_profiles.sql, then try again."
        : creatorProfileErrorMessage(error));
    } finally {
      setCreatorProfileSaving(false);
    }
  }

  async function toggleSavedOpportunity(opportunity){
    if (!session?.user || !accountProfile) {
      setAuthError("");
      setAuthNotice("");
      setRole("login");
      return;
    }
    if (accountProfile.role !== "creator") {
      showToast("Only creator accounts can save opportunities.");
      return;
    }
    if (!supabase) {
      showToast("Supabase is not configured. Check your project settings and try again.");
      return;
    }
    setSavingOpportunityId(opportunity.id);
    setSavedOpportunitiesError("");
    try {
      const alreadySaved = creatorSavedOpportunityIds.includes(opportunity.id);
      if (alreadySaved) {
        const { error } = await supabase.from("saved_opportunities")
          .delete()
          .eq("creator_user_id", session.user.id)
          .eq("promotion_listing_id", opportunity.id);
        if (error) throw error;
        setCreatorSavedOpportunityIds(current => current.filter(id => id !== opportunity.id));
        setSavedOpportunities(current => current.filter(item => item.id !== opportunity.id));
        showToast("Opportunity removed from your saved list.");
      } else {
        const { error } = await supabase.from("saved_opportunities").insert({
          creator_user_id: session.user.id,
          promotion_listing_id: opportunity.id
        });
        if (error && error.code !== "23505") throw error;
        setCreatorSavedOpportunityIds(current => current.includes(opportunity.id) ? current : [...current, opportunity.id]);
        setSavedOpportunities(current => current.some(item => item.id === opportunity.id) ? current : [opportunity, ...current]);
        showToast("Opportunity saved.");
      }
    } catch (error) {
      console.error("Unable to save the promotion opportunity:", error);
      setSavedOpportunitiesError(error?.code === "42P01" || error?.code === "PGRST205"
        ? "Saved opportunities are not set up yet. Apply supabase/migrations/20261012030000_creator_profiles_and_discovery.sql in Supabase."
        : error?.code === "42501"
          ? "Supabase denied this save. Confirm that you are signed in as a Creator and that the listing is still published."
          : "We couldn't update your saved opportunities. Please try again.");
    } finally {
      setSavingOpportunityId("");
    }
  }

  function beginCreatorOffer(opportunity){
    if (!session?.user || !accountProfile) {
      setAuthError("");
      setAuthNotice("");
      setRegistrationRole("creator");
      setRole("login");
      return;
    }
    if (accountProfile.role !== "creator") {
      showToast("Only Creator accounts can submit offers.");
      return;
    }
    if (!creatorProfile) {
      setDashboard(true);
      setCreatorProfileEditing(true);
      setDashboardDestination("creator-profile");
      showToast("Complete your creator profile before submitting an offer.");
      return;
    }
    setOfferListing(opportunity);
    setOfferSubmitError("");
  }

  async function submitCreatorOffer(event){
    event.preventDefault();
    setOfferSubmitError("");
    if (!supabase || !offerListing || accountProfile?.role !== "creator" || !creatorProfile) {
      setOfferSubmitError("A signed-in Creator account with a creator profile is required.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const proposedPrice = Number(form.get("proposed_price"));
    const message = String(form.get("offer_message") || "").trim();
    const deliverables = String(form.get("offer_deliverables") || "").trim();
    const schedule = String(form.get("offer_schedule") || "").trim();
    if (!Number.isFinite(proposedPrice) || proposedPrice < 0 || proposedPrice > 9999999999.99
      || !message || message.length > 4000 || !deliverables || deliverables.length > 4000
      || schedule.length > 1000) {
      setOfferSubmitError("Enter a valid non-negative price, message, and proposed deliverables.");
      return;
    }
    setOfferSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_creator_offer", {
        p_promotion_listing_id: offerListing.id,
        p_proposed_price: proposedPrice,
        p_message: message,
        p_proposed_deliverables: deliverables,
        p_proposed_schedule: schedule || null
      });
      if (error) throw error;
      setOfferListing(null);
      setOffersReload(current => current + 1);
      showToast("Your offer was sent to the business.");
    } catch (error) {
      console.error("Unable to submit creator offer:", error);
      setOfferSubmitError(error?.code === "23505"
        ? "You already have an active or accepted offer for this listing."
        : error?.code === "P0002" || error?.code === "22023"
          ? "This listing is no longer available for offers. Refresh opportunities and try another listing."
          : error?.code === "42501"
            ? "Offer submission requires your Creator account and a saved creator profile."
            : error?.code === "42883" || error?.code === "PGRST202"
              ? "Offers are not set up yet. Apply supabase/migrations/20261012040000_creator_offers.sql in Supabase."
              : "We couldn't submit your offer. Check the details and try again.");
    } finally {
      setOfferSubmitting(false);
    }
  }

  async function respondToOffer(offer, action, counter = null){
    if (!supabase || !offer?.id || !["creator", "business_owner"].includes(accountProfile?.role)) return;
    setOfferActionBusy(offer.id);
    setOfferActionError("");
    setCounterOfferError("");
    try {
      let result;
      if (accountProfile.role === "creator") {
        result = await supabase.rpc("creator_offer_response", {
          p_offer_id: offer.id,
          p_action: action
        });
      } else {
        result = await supabase.rpc("business_offer_action", {
          p_offer_id: offer.id,
          p_action: action,
          p_proposed_price: counter?.proposedPrice ?? null,
          p_message: counter?.message ?? null,
          p_proposed_deliverables: counter?.deliverables ?? null,
          p_proposed_schedule: counter?.schedule ?? null
        });
      }
      if (result.error) throw result.error;
      setCounterOfferId("");
      setOffersReload(current => current + 1);
      if (action === "accept") showToast("Offer accepted. The price and terms are agreed; no collaboration has been created.");
      else if (action === "counteroffer") showToast("Your counteroffer was sent.");
      else if (action === "withdraw") showToast("Your offer was withdrawn.");
      else showToast("Offer rejected.");
    } catch (error) {
      console.error("Unable to update creator offer:", error);
      setOfferActionError(error?.code === "42883" || error?.code === "PGRST202"
        ? "Offer actions are not set up yet. Apply supabase/migrations/20261012040000_creator_offers.sql in Supabase."
        : error?.code === "42501"
          ? "You do not have permission to make that offer change."
          : error?.code === "P0002"
            ? "This offer or listing is no longer available."
            : "We couldn't update this offer. Refresh the offers list and try again.");
    } finally {
      setOfferActionBusy("");
    }
  }

  async function submitCounteroffer(event, offer){
    event.preventDefault();
    setCounterOfferError("");
    const form = new FormData(event.currentTarget);
    const proposedPrice = Number(form.get("counter_price"));
    const message = String(form.get("counter_message") || "").trim();
    const deliverables = String(form.get("counter_deliverables") || "").trim();
    const schedule = String(form.get("counter_schedule") || "").trim();
    if (!Number.isFinite(proposedPrice) || proposedPrice < 0 || proposedPrice > 9999999999.99
      || !message || message.length > 4000 || !deliverables || deliverables.length > 4000
      || schedule.length > 1000) {
      setCounterOfferError("Enter a valid non-negative price, message, and proposed deliverables.");
      return;
    }
    await respondToOffer(offer, "counteroffer", { proposedPrice, message, deliverables, schedule });
  }

  function startListingEditor(listing = null){
    setEditingListing(listing);
    setListingSaveError("");
    setListingSaveSuccess(false);
    setListingStatusError("");
    setListingEditing(true);
  }

  async function savePromotionListing(event){
    event.preventDefault();
    setListingSaveError("");
    setListingSaveSuccess(false);
    if (!supabase || accountProfile?.role !== "business_owner" || !businessProfile?.id) {
      setListingSaveError("Create your business profile and sign in as its Business Owner before creating a promotion listing.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const productService = String(form.get("product_service") || "").trim();
    const promotionType = String(form.get("promotion_type") || "");
    const preferredNiche = String(form.get("preferred_niche") || "").trim();
    const pricingMode = String(form.get("pricing_mode") || "");
    const subscriberRequirement = String(form.get("subscriber_requirement") || "");
    const cityValue = String(form.get("city") || "").trim();
    const location = String(form.get("location") || "").trim();
    const deliverables = String(form.get("deliverables") || "").trim();
    const preferredDate = String(form.get("preferred_date") || "");
    const deadline = String(form.get("deadline") || "");
    const budgetMinValue = String(form.get("budget_min") || "").trim();
    const budgetMaxValue = String(form.get("budget_max") || "").trim();
    const subscriberCountValue = String(form.get("subscriber_count") || "").trim();
    const rawStatus = String(form.get("status") || editingListing?.status || "draft");

    if (!title || !description || !productService || !promotionTypes.includes(promotionType)
      || !preferredNiche || !["fixed", "negotiable", "flexible"].includes(pricingMode)
      || !["preferred", "required"].includes(subscriberRequirement)
      || !cityValue || !location || !deliverables || !preferredDate) {
      setListingSaveError("Complete all required promotion details with valid choices.");
      return;
    }

    const budgetMin = budgetMinValue === "" ? null : Number(budgetMinValue);
    const budgetMax = budgetMaxValue === "" ? null : Number(budgetMaxValue);
    const subscriberCount = subscriberCountValue === "" ? null : Number(subscriberCountValue);
    if ((budgetMin !== null && (!Number.isFinite(budgetMin) || budgetMin < 0))
      || (budgetMax !== null && (!Number.isFinite(budgetMax) || budgetMax < 0))
      || (budgetMin !== null && budgetMin > 9999999999.99)
      || (budgetMax !== null && budgetMax > 9999999999.99)
      || (budgetMin === null && budgetMax === null)) {
      setListingSaveError("Enter at least one non-negative budget amount within the supported range.");
      return;
    }
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      setListingSaveError("Maximum budget must be greater than or equal to minimum budget.");
      return;
    }
    if (subscriberCount !== null && (!Number.isSafeInteger(subscriberCount) || subscriberCount < 0)) {
      setListingSaveError("Subscriber count must be a non-negative whole number.");
      return;
    }
    if (!["draft", "published", "paused", "closed"].includes(rawStatus)
      || (!editingListing && !["draft", "published"].includes(rawStatus))) {
      setListingSaveError("Choose a valid status for this promotion.");
      return;
    }
    const localToday = currentLocalDate();
    if (preferredDate < localToday && preferredDate !== editingListing?.preferred_date) {
      setListingSaveError("Preferred promotion date must be today or later.");
      return;
    }
    if (deadline && ((deadline < localToday && deadline !== editingListing?.deadline) || deadline > preferredDate)) {
      setListingSaveError("Deadline must be today or later, and no later than the preferred promotion date.");
      return;
    }

    setListingSaving(true);
    try {
      const record = {
        business_id: businessProfile.id,
        title,
        description,
        product_service: productService,
        promotion_type: promotionType,
        budget_min: budgetMin,
        budget_max: budgetMax,
        pricing_mode: pricingMode,
        preferred_niche: preferredNiche,
        subscriber_count: subscriberCount,
        subscriber_requirement: subscriberCount === null ? "preferred" : subscriberRequirement,
        city: cityValue,
        location,
        deliverables,
        preferred_date: preferredDate,
        deadline: deadline || null,
        status: rawStatus
      };
      const query = editingListing
        ? supabase.from("promotion_listings").update(record).eq("id", editingListing.id).eq("business_id", businessProfile.id)
        : supabase.from("promotion_listings").insert(record);
      const { data, error } = await query.select(promotionListingColumns).single();
      if (error) throw error;
      setPromotionListings(current => editingListing
        ? current.map(listing => listing.id === data.id ? data : listing)
        : [data, ...current]);
      setListingEditing(false);
      setEditingListing(null);
      setListingSaveSuccess(true);
      showToast(rawStatus === "draft" ? "Promotion draft saved." : "Promotion published.");
    } catch (error) {
      console.error("Unable to save the promotion listing:", error);
      setListingSaveError(error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205"
        ? "Promotion listings are not set up yet. Apply supabase/migrations/20261012020000_promotion_listings.sql, then try again."
        : error?.code === "42501"
          ? "Supabase denied this listing change. Check your owner access and confirm the migration was applied."
          : "We couldn't save this promotion. Check the required fields and try again.");
    } finally {
      setListingSaving(false);
    }
  }

  async function changePromotionStatus(listing, status){
    if (!supabase || !businessProfile?.id || !["published", "paused", "closed"].includes(status)) return;
    if (status === "closed" && !window.confirm("Close this listing? Closed listings cannot be reopened.")) return;
    setListingStatusUpdating(listing.id);
    setListingStatusError("");
    setListingSaveSuccess(false);
    try {
      const { data, error } = await supabase.from("promotion_listings")
        .update({ status })
        .eq("id", listing.id)
        .eq("business_id", businessProfile.id)
        .select(promotionListingColumns)
        .single();
      if (error) throw error;
      setPromotionListings(current => current.map(item => item.id === data.id ? data : item));
      showToast(status === "published" ? "Promotion published." : status === "paused" ? "Promotion paused." : "Promotion closed.");
    } catch (error) {
      console.error("Unable to change promotion status:", error);
      setListingStatusError(error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205"
        ? "Promotion listings are not set up yet. Apply supabase/migrations/20261012020000_promotion_listings.sql."
        : "We couldn't update this promotion. Check your access and try again.");
    } finally {
      setListingStatusUpdating("");
    }
  }

  async function handleProfileSave(event){
    event.preventDefault();
    setAuthError("");
    if (!supabase || !accountProfile) {
      setAuthError("Please log in before saving your profile.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") || "").trim();
    if (!fullName) {
      setAuthError("Enter your name to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: profileError } = await supabase.from("profiles").update({
        full_name: fullName,
        phone: String(form.get("phone") || "").trim()
      }).eq("id", accountProfile.id);
      if (profileError) throw profileError;
      const { data, error: updatedProfileError } = await supabase.from("profiles")
        .select("id,email,full_name,phone,role,created_at")
        .eq("id", accountProfile.id)
        .maybeSingle();
      if (updatedProfileError) throw updatedProfileError;
      setAccountProfile(data || { ...accountProfile, full_name: fullName });
      setRole(null);
      showToast("Profile saved successfully.");
    } catch (error) {
      console.error("Unable to save the authenticated profile:", error);
      setAuthError("Unable to save your profile. Please check the required fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function showToast(msg){
    setToast(msg);
    setTimeout(()=>setToast(""),2200);
  }

  function sendRequest(c){
    if (c.isDemo) {
      setSelected(null);
      showToast(`Demo collaboration request sent to ${c.name}. No account or database write was needed.`);
      return;
    }
    if (accountProfile?.role && accountProfile.role !== "business_owner") {
      showToast("Only business owners can send collaboration requests.");
      return;
    }
    if (!accountProfile) {
      setAuthError("");
      setRole("login");
      showToast("Log in as a business owner to send a request.");
      return;
    }
    setRequestSubmitError("");
    setSelected(null);
    setRequestCreator(c);
  }

  async function toggleSavedCreator(creator){
    if (!session || !accountProfile) {
      setRegistrationRole("business_owner");
      setRole("login");
      showToast("Log in as a business owner to save creators.");
      return;
    }
    if (accountProfile.role !== "business_owner") {
      showToast("Saved creators are available to business owners.");
      return;
    }
    setSavingCreatorId(creator.id);
    try {
      if (savedCreatorIds.includes(creator.id)) {
        const { error } = await supabase.from("saved_creators").delete()
          .eq("business_owner_id", accountProfile.id).eq("creator_id", creator.id);
        if (error) throw error;
        setSavedCreatorIds(ids => ids.filter(id => id !== creator.id));
        showToast("Creator removed from your saved list.");
      } else {
        const { error } = await supabase.from("saved_creators").insert({
          business_owner_id: accountProfile.id,
          creator_id: creator.id
        });
        if (error) throw error;
        setSavedCreatorIds(ids => [...ids, creator.id]);
        showToast("Creator saved.");
      }
    } catch (error) {
      console.error("Unable to update saved creator:", error);
      showToast("We couldn't update your saved creators. Please try again.");
    } finally {
      setSavingCreatorId(null);
    }
  }

  async function refreshNotifications(){
    if (!supabase || !accountProfile?.id) return;
    const { data, error } = await supabase.from("notifications")
      .select("id,type,title,body,collaboration_id,offer_id,reference_id,conversation_id,read_at,created_at")
      .eq("user_id", accountProfile.id).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    setNotifications(data || []);
  }

  async function markNotificationRead(notification){
    if (!supabase || notification.read_at) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("id", notification.id).eq("user_id", accountProfile.id);
    if (error) {
      console.error("Unable to mark notification read:", error);
      showToast("Unable to update this notification.");
      return;
    }
    setNotifications(items => items.map(item => item.id === notification.id
      ? { ...item, read_at: new Date().toISOString() }
      : item));
  }

  async function confirmOfferCollaboration(collaboration, agreedDate){
    if (!supabase || !collaboration || !accountProfile) return;
    setCollaborationActionBusy(collaboration.id);
    setCollaborationsError("");
    try {
      const { error } = await supabase.rpc("confirm_creator_collaboration", {
        p_offer_id: collaboration.offer_id,
        p_agreed_date: agreedDate || null
      });
      if (error) throw error;
      setCollaborationsReload(value => value + 1);
      refreshNotifications().catch(error => {
        console.error("Unable to refresh notifications after confirmation:", error);
        setNotificationsError("The collaboration was confirmed, but notifications could not be refreshed.");
      });
      const ownConfirmed = accountProfile.role === "business_owner"
        ? collaboration.business_confirmed_at
        : collaboration.creator_confirmed_at;
      const otherConfirmed = accountProfile.role === "business_owner"
        ? collaboration.creator_confirmed_at
        : collaboration.business_confirmed_at;
      showToast(otherConfirmed
        ? "Both participants have confirmed. The collaboration is now confirmed."
        : ownConfirmed ? "Your collaboration confirmation was updated."
          : "Your confirmation was saved. The other participant must confirm.");
    } catch (error) {
      console.error("Unable to confirm offer-based collaboration:", error);
      setCollaborationsError(error?.code === "42883" || error?.code === "PGRST202"
        ? "Collaboration confirmation is not set up yet. Apply the collaboration management migration."
        : error?.code === "42501"
          ? "Only the business and creator who made this offer can confirm its collaboration."
          : error?.code === "22023"
            ? error.message || "The agreed campaign date must match the other participant's confirmation and cannot be in the past."
            : "We couldn't save your confirmation. Refresh the collaboration and try again.");
    } finally {
      setCollaborationActionBusy("");
    }
  }

  async function updateCreatorCollaboration(collaboration, status){
    if (!supabase || !collaboration || !accountProfile) return;
    setCollaborationActionBusy(collaboration.id);
    setCollaborationsError("");
    try {
      const { error } = await supabase.rpc("update_creator_collaboration_status", {
        p_collaboration_id: collaboration.id,
        p_status: status
      });
      if (error) throw error;
      setCollaborationsReload(value => value + 1);
      refreshNotifications().catch(error => {
        console.error("Unable to refresh notifications after status update:", error);
        setNotificationsError("The collaboration was updated, but notifications could not be refreshed.");
      });
      showToast(`Collaboration ${status.replaceAll("_", " ")}.`);
    } catch (error) {
      console.error("Unable to update offer-based collaboration:", error);
      setCollaborationsError(error?.code === "42883" || error?.code === "PGRST202"
        ? "Collaboration status updates are not set up yet. Apply the collaboration management migration."
        : error?.code === "42501"
          ? "Only a participant can update this collaboration."
          : error?.code === "22023"
            ? "That status change is not available for this collaboration."
            : "We couldn't update the collaboration. Refresh and try again.");
    } finally {
      setCollaborationActionBusy("");
    }
  }

  async function sendCreatorCollaborationMessage(event){
    event.preventDefault();
    const body = creatorMessageDraft.trim();
    if (!supabase || !creatorConversationId || !activeCreatorCollaboration || !body || !accountProfile) return;
    if (body.length > 5000) {
      setCreatorMessagesError("Messages must be 5,000 characters or fewer.");
      return;
    }
    setCreatorMessageSending(true);
    setCreatorMessagesError("");
    try {
      const { data, error } = await supabase.from("creator_collaboration_messages")
        .insert({ conversation_id: creatorConversationId, sender_id: accountProfile.id, body })
        .select("id,conversation_id,sender_id,body,created_at").single();
      if (error) throw error;
      setCreatorCollaborationMessages(items => [...items, data]);
      setCreatorMessageDraft("");
      refreshNotifications().catch(error => {
        console.error("Unable to refresh notifications after message send:", error);
        setNotificationsError("The message was sent, but notifications could not be refreshed.");
      });
    } catch (error) {
      console.error("Unable to send offer-based collaboration message:", error);
      setCreatorMessagesError(error?.code === "42501"
        ? "Only a participant can send messages in this collaboration."
        : error?.code === "42P01" || error?.code === "PGRST205"
          ? "Collaboration messaging is not set up yet. Apply the collaboration management migration."
          : "Your message couldn't be sent. Please try again.");
    } finally {
      setCreatorMessageSending(false);
    }
  }

  async function sendMessage(event){
    event.preventDefault();
    const body = messageDraft.trim();
    if (!body || !activeChat || !accountProfile) return;
    setMessagesError("");
    const { data, error } = await supabase.from("messages").insert({
      collaboration_id: activeChat.id,
      sender_id: accountProfile.id,
      body
    }).select("id,collaboration_id,sender_id,body,read_at,created_at").single();
    if (error) {
      console.error("Unable to send collaboration message:", error);
      setMessagesError("Your message couldn't be sent. Messages are available after a request is accepted.");
      return;
    }
    setMessages(items => [...items, data]);
    setMessageDraft("");
  }

  async function submitReview(event){
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const collaboration = requests.find(request => request.id === String(form.get("collaboration_id")));
    const rating = Number(form.get("rating"));
    if (!collaboration || collaboration.status !== "completed" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      showToast("Only completed collaborations can be reviewed.");
      return;
    }
    const revieweeId = accountProfile.role === "business_owner"
      ? collaboration.creator?.userId
      : collaboration.business_owner_id;
    if (!revieweeId) {
      showToast("Unable to identify the other participant for this review.");
      return;
    }
    const { error } = await supabase.from("reviews").insert({
      collaboration_id: collaboration.id,
      reviewer_id: accountProfile.id,
      reviewee_id: revieweeId,
      rating,
      review: String(form.get("review") || "").trim()
    });
    if (error) {
      console.error("Unable to submit review:", error);
      showToast(error.code === "23505" ? "You have already reviewed this collaboration." : "Unable to submit your review.");
      return;
    }
    showToast("Thank you for your review.");
  }

  async function submitRequest(event){
    event.preventDefault();
    if (!supabase || !requestCreator || accountProfile?.role !== "business_owner") {
      setRequestSubmitError("Log in as a business owner to send a collaboration request.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const proposedBudget = Number(form.get("proposed_budget"));
    const message = String(form.get("message") || "").trim();
    if (!message || message.length > 5000 || !Number.isFinite(proposedBudget) || proposedBudget < 0) {
      setRequestSubmitError("Enter a valid non-negative budget and a message of up to 5,000 characters.");
      return;
    }
    setRequestSubmitError("");
    setSubmitting(true);
    try {
      if (requestCreator.isRegisteredProfile) {
        const { error } = await supabase.rpc("request_creator_collaboration", {
          p_creator_user_id: requestCreator.userId,
          p_proposed_budget: proposedBudget,
          p_message: message
        });
        if (error) throw error;
        const creatorName = requestCreator.name;
        setRequestCreator(null);
        await refreshCreatorProfileRequests();
        showToast(`Collaboration request recorded for ${creatorName}.`);
        return;
      }
      const { error } = await supabase.from("collaborations").insert({
        business_owner_id: accountProfile.id,
        creator_id: requestCreator.id,
        campaign_name: String(form.get("campaign_name") || "").trim(),
        product_service: String(form.get("product_service") || "").trim(),
        campaign_description: String(form.get("campaign_description") || "").trim(),
        preferred_date: String(form.get("preferred_date") || "") || null,
        deliverables: String(form.get("deliverables") || "").trim(),
        proposed_budget: proposedBudget,
        message
      });
      if (error) throw error;
      const creatorName = requestCreator.name;
      setRequestCreator(null);
      await refreshRequests();
      showToast(`Collaboration request sent to ${creatorName}.`);
    } catch (error) {
      console.error("Unable to submit collaboration request:", error);
      setRequestSubmitError(error?.code === "42P01" || error?.code === "42883" || error?.code === "PGRST202" || error?.code === "PGRST205"
        ? "Registered-profile requests are not set up yet. Apply supabase/migrations/20261012070000_creator_profile_requests.sql."
        : error?.code === "23505"
          ? "You already have a pending request for this creator."
          : "Unable to record this collaboration request. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshCreatorProfileRequests(){
    if (!supabase || !accountProfile?.id || !["creator", "business_owner"].includes(accountProfile.role)) {
      setCreatorProfileRequests([]);
      return;
    }
    const { data, error } = await supabase.from("creator_collaboration_requests")
      .select("id,business_user_id,creator_user_id,business_name,creator_name,proposed_budget,message,status,created_at,responded_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    setCreatorProfileRequests(data || []);
    setCreatorProfileRequestsError("");
  }

  async function respondToCreatorProfileRequest(requestId, status){
    try {
      const { error } = await supabase.rpc("respond_to_creator_collaboration_request", {
        p_request_id: requestId,
        p_status: status
      });
      if (error) throw error;
      await refreshCreatorProfileRequests();
      await refreshNotifications();
      showToast(`Request ${status}.`);
    } catch (error) {
      console.error("Unable to respond to registered-profile collaboration request:", error);
      showToast("Unable to update this request. Check your access and try again.");
    }
  }

  async function updateRequestStatus(requestId, status){
    try {
      const { error } = await supabase.from("collaborations").update({ status }).eq("id", requestId);
      if (error) throw error;
      await refreshRequests();
      await refreshNotifications();
      showToast(`Request ${status}.`);
    } catch {
      showToast("Unable to update this request. Please try again.");
    }
  }

  async function logout(){
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setDashboard(false);
      setRole(null);
      showToast("You have been logged out.");
    } catch {
      showToast("Unable to log out. Please try again.");
    }
  }

  function goToSection(event, id){
    event.preventDefault();
    const section = document.getElementById(id);
    if(section) window.scrollTo({top:section.getBoundingClientRect().top + window.scrollY - 70,behavior:"smooth"});
  }

  function navigatePublic(event, label, href){
    setNavOpen(false);
    if (label === "Discover Opportunities") {
      event.preventDefault();
      setDashboard(false);
      setDashboardDestination("opportunities");
      return;
    }
    if (label === "Login") {
      event.preventDefault();
      setAuthError("");
      setAuthNotice("");
      setRole("login");
      return;
    }
    if (label === "Get Started") {
      event.preventDefault();
      setRegistrationRole("creator");
      setAuthError("");
      setAuthNotice("");
      setRole("signup");
      return;
    }
    if (label === "For Business Owners" || label === "For Creators") {
      event.preventDefault();
      setRegistrationRole(label === "For Business Owners" ? "business_owner" : "creator");
      setAuthError("");
      setAuthNotice("");
      setRole(label === "For Business Owners" ? "business_owner" : "creator");
      return;
    }
    goToSection(event, href.replace("#", ""));
  }

  function navigateDashboard(item){
    setActiveDashboardItem(item.label);
    if (item.action === "editProfile") {
      setRole("business_owner");
      setAuthError("");
      return;
    }
    if (!item.section) return;
    setDashboardDestination(item.section);
    setDashboard(!["creators", "opportunities"].includes(item.section));
  }

  if (!sessionReady) {
    return <div className="authLoadingScreen" role="status">Restoring your secure session…</div>;
  }

  return <div className="app">
    <header className="nav">
      <BrandMark onClick={event=>goToSection(event,"home")}/>
      <button className="navMenuButton outline" aria-label="Toggle navigation" aria-expanded={navOpen} aria-controls="public-navigation" onClick={()=>setNavOpen(open=>!open)}><Menu/></button>
      <div id="public-navigation" className="publicNavigation">
        <PublicNavigation navOpen={navOpen} onNavigate={navigatePublic}/>
      </div>
      <div className="navActions">
        {session && accountProfile ? <>
          <div className="notificationWrap"><button className="notificationButton outline" aria-label={`Notifications, ${unreadNotifications} unread`} onClick={()=>setShowNotifications(open=>!open)}><Bell/>{unreadNotifications > 0 && <span className="notificationBadge">{unreadNotifications}</span>}</button>
            {showNotifications && <div className="notificationPanel"><div className="notificationPanelHead"><strong>Notifications</strong><button type="button" onClick={()=>setShowNotifications(false)} aria-label="Close notifications"><X/></button></div>
              {notificationsLoading && <p className="muted" role="status">Loading notifications…</p>}
              {notificationsError && <p className="formError" role="alert">{notificationsError}</p>}
              {!notificationsLoading && !notificationsError && !notifications.length && <p className="muted">You're all caught up.</p>}
              {notifications.map(notification=><button className={`notificationItem ${notification.read_at ? "" : "unread"}`} key={notification.id} onClick={()=>markNotificationRead(notification)}><strong>{notification.title}</strong><span>{notification.body}</span><small>{new Date(notification.created_at).toLocaleDateString()}</small></button>)}
            </div>}
          </div>
          <button className="outline dashboardButton" aria-label={dashboard?"Close dashboard":"Open dashboard"} onClick={()=>setDashboard(open=>!open)}><LayoutDashboard/> {dashboard?"Close dashboard":"Dashboard"}</button>
          <button className="primary" aria-label="Log out" onClick={logout}><LogOut/> Log Out</button>
        </> : session ? <>
          {profileLoading && <span role="status" className="accountStatus">Loading account…</span>}
          {profileLoadError && <button className="outline" onClick={logout}>Log out</button>}
        </> : null}
      </div>
    </header>

    {session && profileLoadError && <div className="accountLoadError" role="alert">{profileLoadError}</div>}
    {(session && accountProfile) && (
      <div className="dashboardNavShell">
        <DashboardNavigation role={accountProfile.role} activeItem={activeDashboardItem} onNavigate={navigateDashboard}/>
      </div>
    )}

    <section className="hero" id="home">
      <div className="heroPhoto leftPhoto" aria-hidden="true"></div>
      <div className="heroCenter">
        <span className="eyebrow"><span className="eyebrowDot"/> Creator partnerships, made simple</span>
        <h1>Discover Local Businesses. <em>Create Promotions.</em> Earn Through Your Content.</h1>
        <p>Bring local businesses and YouTubers together to create thoughtful promotions and meaningful growth.</p>
        <div className="heroBtns">
          <button className="primary big" onClick={()=>{setRegistrationRole("business_owner"); setRole("signup"); setAuthError("");}}><Store/> I'm a Business Owner <ArrowRight/></button>
          <button className="outline big" onClick={()=>{setRegistrationRole("creator"); setRole("signup"); setAuthError("");}}><Youtube/> I'm a YouTuber</button>
        </div>
      </div>
      <div className="heroPhoto rightPhoto" aria-hidden="true"></div>
    </section>
    <section className="flowStrip" id="how-it-works">
      <div className="workflowHeading"><span className="eyebrow">HOW IT WORKS</span><h2>A simple path to a great promotion</h2></div>
      <WorkflowSteps/>
    </section>

    <section className="opportunityDiscovery" id="opportunities" aria-labelledby="opportunity-discovery-title">
      <div className="opportunityIntro">
        <span className="eyebrow">FOR CREATORS</span>
        <h2 id="opportunity-discovery-title">Discover local promotion opportunities</h2>
        <p>Explore published listings from businesses and find promotions that fit your channel.</p>
      </div>
      <div className="opportunityFilters" aria-label="Filter promotion opportunities">
        <label className="opportunitySearchField"><span>Search opportunities</span><div className="searchBox"><Search aria-hidden="true"/><input value={opportunitySearch} onChange={event=>setOpportunitySearch(event.target.value)} placeholder="Keywords, business, product or service"/></div></label>
        <label>Business category<input value={opportunityCategory} onChange={event=>{setOpportunityCategory(event.target.value);setOpportunityPage(0);}} maxLength="100" placeholder="Any category"/></label>
        <label>City<input value={opportunityCity} onChange={event=>{setOpportunityCity(event.target.value);setOpportunityPage(0);}} maxLength="100" placeholder="Any city"/></label>
        <label>Budget<select value={opportunityBudget} onChange={event=>{setOpportunityBudget(event.target.value);setOpportunityPage(0);}}>{budgetRanges.map(range=><option key={range.label}>{range.label}</option>)}</select></label>
        <label>Promotion type<select value={opportunityType} onChange={event=>{setOpportunityType(event.target.value);setOpportunityPage(0);}}><option value="">Any type</option>{promotionTypes.map(type=><option key={type}>{type}</option>)}</select></label>
        <label>Subscriber requirement<select value={opportunitySubscriberRequirement} onChange={event=>{setOpportunitySubscriberRequirement(event.target.value);setOpportunityPage(0);}}><option value="">Any requirement</option><option value="required">Mandatory</option><option value="preferred">Preferred</option></select></label>
        <label>Sort by<select value={opportunitySort} onChange={event=>{setOpportunitySort(event.target.value);setOpportunityPage(0);}}><option value="recent">Recently posted</option><option value="best">Best match</option></select></label>
        <label className="negotiableFilter"><input type="checkbox" checked={opportunityNegotiable} onChange={event=>{setOpportunityNegotiable(event.target.checked);setOpportunityPage(0);}}/> Negotiable pricing only</label>
        <button type="button" className="outline clearOpportunityFilters" onClick={()=>{setOpportunitySearch("");setDebouncedOpportunitySearch("");setOpportunityCategory("");setOpportunityCity("");setOpportunityBudget("Any budget");setOpportunityNegotiable(false);setOpportunityType("");setOpportunitySubscriberRequirement("");setOpportunitySort("recent");setOpportunityPage(0);}}>Clear filters</button>
      </div>
      <div className="opportunityResultsHeading"><div><h3>Published opportunities</h3><p>{opportunityCount} {opportunityCount === 1 ? "opportunity" : "opportunities"} found</p></div>
        {opportunitySort === "best" && !creatorProfile && <span>Complete your Creator Profile for personalized matches.</span>}
      </div>
      {opportunitiesError && <p className="businessError" role="alert">{opportunitiesError}</p>}
      {savedOpportunitiesError && accountProfile?.role === "creator" && <p className="businessError" role="alert">{savedOpportunitiesError}</p>}
      {opportunitiesLoading && <p className="businessState" role="status">Loading published opportunities…</p>}
      {!opportunitiesLoading && !opportunitiesError && opportunities.length === 0 && <div className="promotionEmpty"><span className="businessEmptyIcon"><Search aria-hidden="true"/></span><h4>No published opportunities match those filters</h4><p>Try a different keyword, city, budget, or promotion type.</p></div>}
      {!opportunitiesLoading && opportunities.length > 0 && <div className="opportunityGrid">
        {opportunities.map(opportunity=>{
          const priorOffer = creatorOffers.find(offer=>offer.promotion_listing_id === opportunity.id);
          const blocked = priorOffer && ["pending_business", "pending_creator", "accepted"].includes(priorOffer.status);
          const label = priorOffer?.status === "accepted" ? "Terms agreed"
            : priorOffer && ["pending_business", "pending_creator"].includes(priorOffer.status) ? "Offer pending"
              : priorOffer ? "Submit another offer" : "Make an offer";
          return <OpportunityCard key={opportunity.id} opportunity={opportunity} saved={creatorSavedOpportunityIds.includes(opportunity.id)} saving={savingOpportunityId === opportunity.id} canSave={!session || accountProfile?.role === "creator"} onSave={toggleSavedOpportunity} onOffer={beginCreatorOffer} offerDisabled={Boolean(blocked) || offersLoading} offerLabel={label}/>;
        })}
      </div>}
      {opportunityCount > PAGE_SIZE && <div className="pagination opportunityPagination"><button type="button" className="outline" disabled={opportunitiesLoading || opportunityPage === 0} onClick={()=>setOpportunityPage(page=>page-1)}>Previous</button><span>Page {opportunityPage + 1} of {Math.ceil(opportunityCount / PAGE_SIZE)}</span><button type="button" className="outline" disabled={opportunitiesLoading || (opportunityPage + 1) * PAGE_SIZE >= opportunityCount} onClick={()=>setOpportunityPage(page=>page+1)}>Next</button></div>}
    </section>

    <section className="searchPanel" id="creators">
      <div className="searchBox"><Search aria-hidden="true"/><input aria-label="Search YouTube creators" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search YouTubers by name, niche, keywords..."/></div>
      <button className="primary searchBtn" onClick={()=>document.querySelector(".results")?.scrollIntoView({behavior:"smooth"})}>Find Creators <ArrowRight/></button>
    </section>

    <main className="content">
      <section className="results">
        <div className="resultHead"><div><h2>Find your next creator</h2><p>{matchedCreatorCount} creators match your requirements, including demo profiles</p></div>
          <label>Sort by: <select value={sort} onChange={e=>{setSort(e.target.value);setPage(0)}}>{["Best Match","Lowest Price","Highest Engagement","Most Subscribers","Recently Joined"].map(item=><option key={item}>{item}</option>)}</select></label>
        </div>
        {creatorLoadError && <p className="businessError" role="alert">{creatorLoadError}</p>}
        <div className="grid">
          {creatorsLoading && Array.from({length:6},(_,index)=><div className="creatorSkeleton" key={index}><div/><span/><span/><span/></div>)}
          {filtered.map(c=><CreatorCard key={c.id} creator={c} sent={!c.isDemo && (requests.some(request=>request.creator_id===c.id && request.status!=="rejected") || creatorProfileRequests.some(request=>request.creator_user_id===c.userId && request.business_user_id===accountProfile?.id && request.status==="pending"))} canCollaborate={c.isDemo || accountProfile?.role!=="creator"} saving={savingCreatorId===c.id} onSave={()=>toggleSavedCreator(c)} onView={()=>setSelected(c)} onSend={()=>sendRequest(c)}/>)}
          {!creatorsLoading && !filtered.length && <div className="empty" role={creatorLoadError ? "alert" : undefined}>{creatorLoadError || (registeredCreatorCount ? "No creators match your requirements. Try changing your search." : "No creators found. Try changing your search.")}</div>}
        </div>
        {registeredCreatorCount > PAGE_SIZE && <div className="pagination"><button className="outline" disabled={page===0} onClick={()=>setPage(current=>current-1)}>Previous</button><span>Page {page+1} of {Math.ceil(registeredCreatorCount/PAGE_SIZE)}</span><button className="outline" disabled={(page+1)*PAGE_SIZE>=registeredCreatorCount} onClick={()=>setPage(current=>current+1)}>Next</button></div>}
      </section>

      <aside className="why" id="about">
        <h3>Why CreatorConnect?</h3>
        <Feature icon={<ShieldCheck/>} title="Creator-first profiles" text="Transparent details and pricing"/>
        <Feature icon={<BarChart3/>} title="Easy Comparison" text="Check stats, niche, budget"/>
        <Feature icon={<MessageCircle/>} title="Direct Collaboration" text="Send request & discuss"/>
        <Feature icon={<BarChart3/>} title="Grow Your Sales" text="Reach targeted audience"/>
        <div className="shopCard" id="shop-account"><Store/><h3>List Your Business<br/>and Find Creators</h3><p>Promote your products or services with the right YouTubers.</p><button className="primary" onClick={()=>setRole("shop")}>Create Business Account <ArrowRight/></button></div>
      </aside>
    </main>

    {dashboard && accountProfile && <section className="dashboardPanel" id="dashboard">
      <div className="dashboardHeading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Welcome back, {accountProfile.role === "creator" ? creatorProfile?.channel_name || accountProfile.full_name : businessProfile?.business_name || accountProfile.full_name}</h2><p>{accountProfile.email}</p></div>{accountProfile.role === "creator" && <button className="outline" onClick={()=>{setCreatorProfileEditing(true);setDashboardDestination("creator-profile");}}><UserRound/> Edit Creator Profile</button>}</div>
      {accountProfile.role === "business_owner" ? <>
        <section className="businessOverview" aria-labelledby="business-overview-title">
          <div className="businessOverviewCopy">
            <span className="eyebrow">BUSINESS OVERVIEW</span>
            <h3 id="business-overview-title">{businessProfile?.business_name || "Your business, your next chapter."}</h3>
            <p>{businessProfile
              ? `${businessProfile.category} · ${businessProfile.city}, ${businessProfile.state}`
              : "Create your business profile to introduce your company to local creators. Your profile is private until you choose to make it public."}</p>
          </div>
          <div className="businessOverviewStatus">
            <span className={`businessStatus ${businessProfile?.is_public ? "public" : ""}`}>
              {businessProfile ? businessProfile.is_public ? "Public profile" : "Private profile" : "Profile not created"}
            </span>
            <button className="primary" onClick={()=>{setBusinessEditing(true);setBusinessSaveError("");setBusinessSaveSuccess(false);document.getElementById("business-profile")?.scrollIntoView({behavior:"smooth",block:"start"});}}>
              {businessProfile ? "Edit business profile" : "Create business profile"} <ArrowRight/>
            </button>
          </div>
        </section>
        <section className="businessProfileSection" id="business-profile" aria-labelledby="business-profile-title">
          <div className="businessSectionHeading">
            <div><span className="eyebrow">MY BUSINESS PROFILE</span><h3 id="business-profile-title">Business details</h3><p>Manage the information you share about your business.</p></div>
            {businessProfile && !businessEditing && <button type="button" className="outline" onClick={()=>{setBusinessEditing(true);setBusinessSaveError("");setBusinessSaveSuccess(false);}}>Edit profile</button>}
          </div>
          {businessLoading && <p className="businessState" role="status">Loading your business profile…</p>}
          {businessLoadError && !businessLoading && <p className="businessError" role="alert">{businessLoadError}</p>}
          {businessSaveSuccess && !businessEditing && <p className="businessSuccess" role="status">Your business profile has been saved.</p>}
          {!businessLoading && !businessLoadError && !businessProfile && !businessEditing && <div className="businessEmpty">
            <span className="businessEmptyIcon"><Store aria-hidden="true"/></span>
            <h4>No business profile yet</h4>
            <p>Add your real business details when you’re ready. You can keep the profile private until you choose to publish its public information.</p>
            <button className="primary" onClick={()=>{setBusinessEditing(true);setBusinessSaveError("");}}>Create business profile <ArrowRight/></button>
          </div>}
          {!businessLoading && businessProfile && !businessEditing && <article className="businessProfileCard">
            {businessProfile.logo_url
              ? <img className="businessLogo" src={businessProfile.logo_url} alt={`${businessProfile.business_name} logo`}/>
              : <span className="businessLogo businessLogoPlaceholder"><Store aria-hidden="true"/></span>}
            <div className="businessProfileCardBody">
              <div className="businessProfileCardTop"><div><h4>{businessProfile.business_name}</h4><p>{businessProfile.category} · {businessProfile.city}, {businessProfile.state}</p></div><span className={`businessStatus ${businessProfile.is_public ? "public" : ""}`}>{businessProfile.is_public ? "Public" : "Private"}</span></div>
              {businessProfile.description && <p className="businessDescription">{businessProfile.description}</p>}
              <div className="businessProfileMeta">
                {businessProfile.contact_email && <span>{businessProfile.contact_email}</span>}
                {businessProfile.contact_phone && <span>{businessProfile.contact_phone}</span>}
                {businessProfile.website_url && <a href={businessProfile.website_url} target="_blank" rel="noreferrer">{businessProfile.website_url}</a>}
                {businessProfile.address && <span>{businessProfile.address}</span>}
              </div>
              {businessProfile.photo_urls?.length > 0 && <div className="businessPhotos" aria-label="Business photographs">{businessProfile.photo_urls.map((url,index)=><img key={`${url}-${index}`} src={url} alt={`${businessProfile.business_name} photo ${index+1}`} loading="lazy"/>)}</div>}
            </div>
          </article>}
          {businessEditing && <form className="businessForm" onSubmit={saveBusinessProfile} onChange={()=>{setBusinessSaveError("");setBusinessSaveSuccess(false);}}>
            <div className="businessFormGrid">
              <label>Business name<input name="business_name" defaultValue={businessProfile?.business_name || ""} maxLength="120" autoComplete="organization" required/></label>
              <label>Owner name<input name="owner_name" defaultValue={businessProfile?.owner_name || accountProfile.full_name || ""} maxLength="120" autoComplete="name" required/></label>
              <label>Business category<input name="category" defaultValue={businessProfile?.category || ""} maxLength="100" required/></label>
              <label>City<input name="city" defaultValue={businessProfile?.city || ""} maxLength="100" autoComplete="address-level2" required/></label>
              <label>State<input name="state" defaultValue={businessProfile?.state || ""} maxLength="100" autoComplete="address-level1" required/></label>
              <label>Business address <span className="optionalField">(optional)</span><input name="address" defaultValue={businessProfile?.address || ""} maxLength="300" autoComplete="street-address"/></label>
              <label>Contact email <span className="optionalField">(private)</span><input name="contact_email" type="email" defaultValue={businessProfile?.contact_email || accountProfile.email || ""} autoComplete="email"/></label>
              <label>Contact phone <span className="optionalField">(private)</span><input name="contact_phone" type="tel" defaultValue={businessProfile?.contact_phone || ""} maxLength="40" autoComplete="tel"/></label>
              <label>Website URL <span className="optionalField">(optional)</span><input name="website_url" type="url" placeholder="https://example.com" defaultValue={businessProfile?.website_url || ""}/></label>
              <label>Logo image URL <span className="optionalField">(optional)</span><input name="logo_url" type="url" placeholder="https://…" defaultValue={businessProfile?.logo_url || ""}/></label>
              <div className="businessFormWide"><ImageFileInputs name="business_logo_file" label="Business logo photo"/></div>
              <label className="businessFormWide">Description<textarea name="description" defaultValue={businessProfile?.description || ""} maxLength="3000" rows="4"/></label>
              <label>Instagram URL <span className="optionalField">(optional)</span><input name="instagram_url" type="url" placeholder="https://instagram.com/…" defaultValue={businessProfile?.social_links?.instagram || ""}/></label>
              <label>Facebook URL <span className="optionalField">(optional)</span><input name="facebook_url" type="url" placeholder="https://facebook.com/…" defaultValue={businessProfile?.social_links?.facebook || ""}/></label>
              <label>YouTube URL <span className="optionalField">(optional)</span><input name="youtube_url" type="url" placeholder="https://youtube.com/…" defaultValue={businessProfile?.social_links?.youtube || ""}/></label>
              <label>TikTok URL <span className="optionalField">(optional)</span><input name="tiktok_url" type="url" placeholder="https://tiktok.com/…" defaultValue={businessProfile?.social_links?.tiktok || ""}/></label>
              <label className="businessFormWide">Photograph URLs <span className="optionalField">(optional, one per line)</span><textarea name="photo_urls" defaultValue={(businessProfile?.photo_urls || []).join("\n")} placeholder={"https://…\nhttps://…"} rows="3"/></label>
              <div className="businessFormWide"><ImageFileInputs name="business_photo_files" label="Business photos" multiple/></div>
              <label className="businessFormWide">Opening hours <span className="optionalField">(optional)</span><textarea name="opening_hours" defaultValue={businessProfile?.opening_hours || ""} placeholder={"Monday–Friday: 9:00 AM–6:00 PM"} rows="2"/></label>
            </div>
            <label className="businessVisibility"><input name="is_public" type="checkbox" defaultChecked={businessProfile?.is_public || false}/><span><strong>Make public business information visible</strong><small>Only your business name, category, description, city/state, images, website/social links, and opening hours are shown. Owner name, address, and contact details stay private.</small></span></label>
            {businessSaveError && <p className="businessError" role="alert">{businessSaveError}</p>}
            <div className="businessFormActions">
              <button className="primary" disabled={businessSaving}>{businessSaving ? "Saving profile…" : businessProfile ? "Save changes" : "Create business profile"}</button>
              {businessProfile && <button type="button" className="outline" disabled={businessSaving} onClick={()=>{setBusinessEditing(false);setBusinessSaveError("");}}>Cancel</button>}
            </div>
          </form>}
        </section>
        <section className="promotionListingsSection" id="promotion-listings" aria-labelledby="promotion-listings-title">
          <div className="businessSectionHeading">
            <div><span className="eyebrow">MY PROMOTION LISTINGS</span><h3 id="promotion-listings-title">Promotions for creators</h3><p>Publish opportunities, manage their status, and review incoming offers in Creator Offers.</p></div>
            {businessProfile && !listingEditing && <button type="button" className="primary" onClick={()=>startListingEditor()}><Plus/> Create listing</button>}
          </div>
          {!businessProfile && !businessLoading && !businessLoadError && <div className="businessState">Create your business profile before adding promotion listings.</div>}
          {businessLoading && <p className="businessState" role="status">Loading your business profile…</p>}
          {businessLoadError && !businessLoading && <p className="businessError" role="alert">{businessLoadError}</p>}
          {businessProfile && listingsLoading && <p className="businessState" role="status">Loading your promotion listings…</p>}
          {businessProfile && listingsLoadError && !listingsLoading && <p className="businessError" role="alert">{listingsLoadError}</p>}
          {businessProfile && listingSaveSuccess && !listingEditing && <p className="businessSuccess" role="status">Your promotion listing has been saved.</p>}
          {businessProfile && listingStatusError && <p className="businessError" role="alert">{listingStatusError}</p>}
          {businessProfile && !listingsLoading && !listingsLoadError && !promotionListings.length && !listingEditing && <div className="promotionEmpty">
            <span className="businessEmptyIcon"><Megaphone aria-hidden="true"/></span>
            <h4>No promotion listings yet</h4>
            <p>Publish an opportunity for creators or save a draft to finish later. No sample listings are added.</p>
            <button type="button" className="primary" onClick={()=>startListingEditor()}><Plus/> Create your first listing</button>
          </div>}
          {businessProfile && listingEditing && <form className="promotionForm" onSubmit={savePromotionListing} onChange={()=>{setListingSaveError("");setListingSaveSuccess(false);}}>
            <div className="promotionFormHeading"><div><h4>{editingListing ? "Edit promotion listing" : "New promotion listing"}</h4><p>Required information is marked with an asterisk.</p></div></div>
            <div className="promotionFormGrid">
              <label className="promotionFormWide">Promotion title *<input name="title" defaultValue={editingListing?.title || ""} maxLength="140" required/></label>
              <label>Product or service *<input name="product_service" defaultValue={editingListing?.product_service || ""} maxLength="160" required/></label>
              <label>Promotion type *<select name="promotion_type" defaultValue={editingListing?.promotion_type || ""} required><option value="" disabled>Select a type</option>{promotionTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label>
              <label className="promotionFormWide">Description *<textarea name="description" defaultValue={editingListing?.description || ""} maxLength="4000" rows="4" required/></label>
              <label>Pricing mode *<select name="pricing_mode" defaultValue={editingListing?.pricing_mode || "negotiable"} required><option value="fixed">Fixed</option><option value="negotiable">Negotiable</option><option value="flexible">Flexible</option></select></label>
              <label>Preferred creator niche *<select name="preferred_niche" defaultValue={editingListing?.preferred_niche || ""} required><option value="" disabled>Select a niche</option>{niches.slice(1).map(item=><option key={item}>{item}</option>)}</select></label>
              <label>Minimum budget (₹)<input name="budget_min" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={editingListing?.budget_min ?? ""}/></label>
              <label>Maximum budget (₹)<input name="budget_max" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={editingListing?.budget_max ?? ""}/></label>
              <p className="promotionFieldHint promotionFormWide">Enter at least one amount. Enter both for a budget range; the maximum must be at least the minimum.</p>
              <label>Minimum / preferred subscribers<input name="subscriber_count" type="number" min="0" step="1" defaultValue={editingListing?.subscriber_count ?? ""}/></label>
              <label>Subscriber requirement<select name="subscriber_requirement" defaultValue={editingListing?.subscriber_requirement || "preferred"}><option value="preferred">Preferred</option><option value="required">Mandatory</option></select></label>
              <label>City *<input name="city" defaultValue={editingListing?.city || businessProfile.city} maxLength="100" required/></label>
              <label>Location *<input name="location" defaultValue={editingListing?.location || ""} maxLength="240" placeholder="Neighbourhood, venue, or area" required/></label>
              <label className="promotionFormWide">Deliverables *<textarea name="deliverables" defaultValue={editingListing?.deliverables || ""} maxLength="2000" rows="3" required/></label>
              <label>Preferred date *<input name="preferred_date" type="date" min={editingListing?.preferred_date && editingListing.preferred_date < currentLocalDate() ? editingListing.preferred_date : currentLocalDate()} defaultValue={editingListing?.preferred_date || ""} required/></label>
              <label>Deadline (optional)<input name="deadline" type="date" min={editingListing?.deadline && editingListing.deadline < currentLocalDate() ? editingListing.deadline : currentLocalDate()} defaultValue={editingListing?.deadline || ""}/></label>
              <label>Listing status *<select name="status" defaultValue={editingListing?.status === "closed" ? "closed" : editingListing?.status || "draft"} disabled={editingListing?.status === "closed"} required><option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option>{editingListing?.status === "closed" && <option value="closed">Closed</option>}</select></label>
            </div>
            {listingSaveError && <p className="businessError" role="alert">{listingSaveError}</p>}
            <div className="businessFormActions">
              <button type="submit" className="primary" disabled={listingSaving}>{listingSaving ? "Saving listing…" : editingListing ? "Save changes" : "Save listing"}</button>
              <button type="button" className="outline" disabled={listingSaving} onClick={()=>{setListingEditing(false);setEditingListing(null);setListingSaveError("");}}>Cancel</button>
            </div>
          </form>}
          {businessProfile && !listingsLoading && !listingsLoadError && promotionListings.length > 0 && <div className="promotionListingList">
            {promotionListings.map(listing=><article className="promotionListingCard" key={listing.id}>
              <div className="promotionListingHead">
                <div><span className={`promotionStatus promotionStatus-${listing.status}`}>{listing.status}</span><h4>{listing.title}</h4><p>{listing.promotion_type} · {listing.product_service}</p></div>
                <button type="button" className="outline" disabled={listingStatusUpdating === listing.id} onClick={()=>startListingEditor(listing)}>Edit</button>
              </div>
              <p className="promotionListingDescription">{listing.description}</p>
              <div className="promotionListingDetails">
                <span><strong>Budget</strong>{listing.budget_min != null && listing.budget_max != null ? `₹${Number(listing.budget_min).toLocaleString("en-IN")}–₹${Number(listing.budget_max).toLocaleString("en-IN")}` : listing.budget_min != null ? `From ₹${Number(listing.budget_min).toLocaleString("en-IN")}` : `Up to ₹${Number(listing.budget_max).toLocaleString("en-IN")}`} · {listing.pricing_mode}</span>
                <span><strong>Niche</strong>{listing.preferred_niche}</span>
                {listing.subscriber_count != null && <span><strong>Subscribers</strong>{Number(listing.subscriber_count).toLocaleString("en-IN")} {listing.subscriber_requirement}</span>}
                <span><strong>Location</strong>{listing.location}, {listing.city}</span>
                <span><strong>Preferred date</strong>{new Date(`${listing.preferred_date}T00:00:00`).toLocaleDateString()}</span>
                {listing.deadline && <span><strong>Deadline</strong>{new Date(`${listing.deadline}T00:00:00`).toLocaleDateString()}</span>}
              </div>
              <p className="promotionDeliverables"><strong>Deliverables</strong>{listing.deliverables}</p>
              <div className="promotionListingActions">
                {listing.status === "draft" && <button type="button" className="primary" disabled={listingStatusUpdating === listing.id} onClick={()=>changePromotionStatus(listing,"published")}>{listingStatusUpdating === listing.id ? "Updating…" : "Publish"}</button>}
                {listing.status === "published" && <button type="button" className="outline" disabled={listingStatusUpdating === listing.id} onClick={()=>changePromotionStatus(listing,"paused")}>{listingStatusUpdating === listing.id ? "Updating…" : "Pause listing"}</button>}
                {listing.status === "paused" && <button type="button" className="primary" disabled={listingStatusUpdating === listing.id} onClick={()=>changePromotionStatus(listing,"published")}>{listingStatusUpdating === listing.id ? "Updating…" : "Resume and publish"}</button>}
                {listing.status !== "closed" && <button type="button" className="outline closeListingButton" disabled={listingStatusUpdating === listing.id} onClick={()=>changePromotionStatus(listing,"closed")}>Close listing</button>}
              </div>
            </article>)}
          </div>}
        </section>
        <section className="businessSettings" id="business-settings">
          <div><span className="eyebrow">SETTINGS</span><h3>Account settings</h3><p>Update your account name, phone number, or sign out securely.</p></div>
          <button className="outline" onClick={()=>{setAuthError("");setRole("business_owner");}}>Edit account details <UserRound/></button>
        </section>
      </> : <>
      {accountProfile.role === "creator" && <section className="creatorProfileSection" id="creator-profile" aria-labelledby="creator-profile-title">
        <div className="businessSectionHeading">
          <div><span className="eyebrow">CREATOR PROFILE</span><h3 id="creator-profile-title">Your channel profile</h3><p>Manage your channel details, promotion preferences, and availability.</p></div>
          {creatorProfile && !creatorProfileEditing && <button type="button" className="outline" onClick={()=>{setCreatorProfileEditing(true);setCreatorProfileSaveError("");setCreatorProfileSaveSuccess(false);}}>Edit profile</button>}
        </div>
        {creatorProfileLoading && <p className="businessState" role="status">Loading your creator profile…</p>}
        {creatorProfileError && !creatorProfileLoading && <p className="businessError" role="alert">{creatorProfileError}</p>}
        {creatorProfileSaveSuccess && !creatorProfileEditing && <p className="businessSuccess" role="status">Your creator profile has been saved.</p>}
        {!creatorProfileLoading && !creatorProfileError && !creatorProfile && !creatorProfileEditing && <div className="businessEmpty">
          <span className="businessEmptyIcon"><Youtube aria-hidden="true"/></span><h4>No creator profile yet</h4>
          <p>Add your channel details and preferences to get more relevant opportunity matches.</p>
          <button type="button" className="primary" onClick={()=>{setCreatorProfileEditing(true);setCreatorProfileSaveError("");}}>Create creator profile</button>
        </div>}
        {!creatorProfileLoading && creatorProfile && !creatorProfileEditing && <article className="creatorProfileSummary">
          <div className="creatorProfileSummaryHead"><div><h4>{creatorProfile.channel_name}</h4><p>{creatorProfile.full_name} · {creatorProfile.niche} · {creatorProfile.city}, {creatorProfile.state}</p></div><span className={`businessStatus ${creatorProfile.availability === "available" ? "public" : ""}`}>{creatorProfile.availability}</span></div>
          <a href={creatorProfile.channel_url} target="_blank" rel="noreferrer">{creatorProfile.channel_url}</a>
          {creatorProfile.biography && <p className="businessDescription">{creatorProfile.biography}</p>}
          <div className="promotionListingDetails creatorProfileMeta">
            <span><strong>Subscribers</strong>{Number(creatorProfile.subscriber_count).toLocaleString("en-IN")}</span>
            {creatorProfile.average_views != null && <span><strong>Average views</strong>{Number(creatorProfile.average_views).toLocaleString("en-IN")}</span>}
            <span><strong>Location</strong>{creatorProfile.location}, {creatorProfile.city}</span>
            {creatorProfile.minimum_fee != null && <span><strong>Minimum fee</strong>{money(Number(creatorProfile.minimum_fee))}</span>}
            {creatorProfile.preferred_travel_distance_km != null && <span><strong>Travel preference</strong>Up to {creatorProfile.preferred_travel_distance_km} km</span>}
            {creatorProfile.promotion_interests?.length > 0 && <span><strong>Interests</strong>{creatorProfile.promotion_interests.join(", ")}</span>}
            {creatorProfile.preferred_promotion_types?.length > 0 && <span><strong>Preferred promotion types</strong>{creatorProfile.preferred_promotion_types.join(", ")}</span>}
          </div>
        </article>}
        {creatorProfileEditing && <form className="promotionForm" onSubmit={saveCreatorProfile} onChange={()=>{setCreatorProfileSaveError("");setCreatorProfileSaveSuccess(false);}}>
          <div className="promotionFormGrid">
            <label>Full name *<input name="creator_full_name" defaultValue={creatorProfile?.full_name || accountProfile.full_name || ""} autoComplete="name" maxLength="120" required/></label>
            <label>Creator / channel name *<input name="channel_name" defaultValue={creatorProfile?.channel_name || ""} maxLength="120" required/></label>
            <label className="promotionFormWide">YouTube channel URL *<input name="channel_url" type="url" placeholder="https://www.youtube.com/@yourchannel" defaultValue={creatorProfile?.channel_url || ""} required/></label>
            <label>Subscriber count *<input name="subscriber_count" type="number" min="0" max="9007199254740991" step="1" defaultValue={creatorProfile?.subscriber_count ?? ""} required/></label>
            <label>Average views <span className="optionalField">(optional)</span><input name="average_views" type="number" min="0" max="9007199254740991" step="1" defaultValue={creatorProfile?.average_views ?? ""}/></label>
            <label>Content niche *<select name="creator_niche" defaultValue={creatorProfile?.niche || ""} required><option value="" disabled>Select a niche</option>{niches.slice(1).map(item=><option key={item}>{item}</option>)}</select></label>
            <label>City *<input name="creator_city" defaultValue={creatorProfile?.city || ""} maxLength="100" autoComplete="address-level2" required/></label>
            <label>State *<input name="creator_state" defaultValue={creatorProfile?.state || ""} maxLength="100" autoComplete="address-level1" required/></label>
            <label className="promotionFormWide">Profile photo URL <span className="optionalField">(optional)</span><input name="profile_image_url" type="url" placeholder="https://…" defaultValue={creatorProfile?.profile_image_url || ""}/></label>
            <div className="promotionFormWide"><ImageFileInputs name="creator_profile_image_file" label="Creator profile photo"/></div>
            <label className="promotionFormWide">Location / neighbourhood *<input name="creator_location" defaultValue={creatorProfile?.location || ""} maxLength="180" placeholder="Area or neighbourhood; precise coordinates are not required" required/></label>
            <label className="promotionFormWide">Biography<textarea name="biography" defaultValue={creatorProfile?.biography || ""} rows="4" maxLength="3000"/></label>
            <fieldset className="creatorChoiceGroup promotionFormWide"><legend>Promotion interests</legend><div>{niches.slice(1).map(item=><label key={item}><input type="checkbox" name="promotion_interests" value={item} defaultChecked={creatorProfile?.promotion_interests?.includes(item)}/>{item}</label>)}</div></fieldset>
            <fieldset className="creatorChoiceGroup promotionFormWide"><legend>Preferred promotion types</legend><div>{creatorPromotionTypes.map(item=><label key={item}><input type="checkbox" name="preferred_promotion_types" value={item} defaultChecked={creatorProfile?.preferred_promotion_types?.includes(item)}/>{item}</label>)}</div></fieldset>
            <label>Minimum fee <span className="optionalField">(optional, ₹)</span><input name="minimum_fee" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={creatorProfile?.minimum_fee ?? ""}/></label>
            <label>Availability *<select name="creator_availability" defaultValue={creatorProfile?.availability || "available"}><option value="available">Available for promotions</option><option value="busy">Limited availability</option><option value="unavailable">Not accepting promotions</option></select></label>
            <label>Preferred travel distance (km)<span className="optionalField">(optional)</span><input name="preferred_travel_distance_km" type="number" min="0" max="10000" step="1" defaultValue={creatorProfile?.preferred_travel_distance_km ?? ""}/></label>
            <p className="promotionFieldHint">Distance is stored as your preference only. Discovery uses the city you enter; no precise location data or distance calculation is collected.</p>
          </div>
          {creatorProfileSaveError && <p className="businessError" role="alert">{creatorProfileSaveError}</p>}
          <div className="businessFormActions"><button type="submit" className="primary" disabled={creatorProfileSaving}>{creatorProfileSaving ? "Saving profile…" : creatorProfile ? "Save changes" : "Create creator profile"}</button>{creatorProfile && <button type="button" className="outline" disabled={creatorProfileSaving} onClick={()=>{setCreatorProfileEditing(false);setCreatorProfileSaveError("");}}>Cancel</button>}</div>
        </form>}
      </section>}
      {accountProfile.role === "creator" && <div className="completionPanel"><div><strong>{creatorProfile ? "Your profile is ready" : "Complete your profile"}</strong><span>{creatorProfile ? "Your details help us rank opportunities that fit your channel." : "Add your channel details to get more relevant opportunity matches."}</span></div><div className="completionTrack"><span style={{width:creatorProfile ? "100%" : "0%"}}/></div><button className="outline" onClick={()=>{setCreatorProfileEditing(true);setDashboardDestination("creator-profile");}}>{creatorProfile ? "Edit Profile" : "Create Profile"}</button></div>}
      <div className="dashboardStats">
        <StatCard label={accountProfile.role === "creator" ? "Requests received" : "Active requests"} value={requests.length + creatorProfileRequests.length}/>
        <StatCard label="Pending" value={requests.filter(request=>request.status==="pending").length + creatorProfileRequests.filter(request=>request.status==="pending").length}/>
        <StatCard label="Accepted" value={requests.filter(request=>request.status==="accepted").length + creatorProfileRequests.filter(request=>request.status==="accepted").length}/>
        <StatCard label={accountProfile.role === "creator" ? "Completed" : "Saved creators"} value={accountProfile.role === "creator" ? requests.filter(request=>request.status==="completed").length : savedCreatorIds.length}/>
      </div>
      <div className="dashboardQuickActions">{accountProfile.role === "creator" ? <button className="outline" onClick={()=>{setDashboard(false);setDashboardDestination("opportunities");}}><Search/> Discover Opportunities</button> : <button className="outline" onClick={()=>{setDashboard(false);setDashboardDestination("creators");}}><Search/> Find Creators</button>}<button className="outline" onClick={()=>document.getElementById("my-requests")?.scrollIntoView({behavior:"smooth"})}><Handshake/> My Requests</button>{accountProfile.role === "business_owner" && <button className="outline" onClick={()=>document.getElementById("saved-creators")?.scrollIntoView({behavior:"smooth"})}><Bookmark/> Saved Creators</button>}</div>
      <div className="dashboardProfile"><h3>My Profile</h3>{accountProfile.role === "creator" ? <p>{creatorProfile?.channel_name || accountProfile.full_name} · {creatorProfile?.niche || "Profile not completed"} · {creatorProfile?.city || ""}</p> : <p>{shopProfile?.business_name || accountProfile.full_name} · {shopProfile?.business_type || "Profile not completed"} · {shopProfile?.city || ""}</p>}</div>
      {accountProfile.role === "creator" && <section className="savedSection" id="saved-opportunities"><div className="dashboardSubhead"><h3>Saved opportunities</h3><span>{creatorSavedOpportunityIds.length}</span></div>
        {savedOpportunitiesError && <p className="businessError" role="alert">{savedOpportunitiesError}</p>}
        {savedOpportunitiesLoading && <p className="businessState" role="status">Loading saved opportunities…</p>}
        {!savedOpportunitiesLoading && !savedOpportunitiesError && !creatorSavedOpportunityIds.length && <p className="muted">Save published opportunities you may want to explore later.</p>}
        {!savedOpportunitiesLoading && creatorSavedOpportunityIds.length > savedOpportunities.length && <p className="muted">Some saved opportunities are no longer published and are not currently available.</p>}
        <div className="opportunityGrid">{savedOpportunities.map(opportunity=>{
          const priorOffer = creatorOffers.find(offer=>offer.promotion_listing_id === opportunity.id);
          const blocked = priorOffer && ["pending_business", "pending_creator", "accepted"].includes(priorOffer.status);
          const label = priorOffer?.status === "accepted" ? "Terms agreed"
            : priorOffer && ["pending_business", "pending_creator"].includes(priorOffer.status) ? "Offer pending"
              : priorOffer ? "Submit another offer" : "Make an offer";
          return <OpportunityCard key={opportunity.id} opportunity={opportunity} saved saving={savingOpportunityId === opportunity.id} canSave onSave={toggleSavedOpportunity} onOffer={beginCreatorOffer} offerDisabled={Boolean(blocked) || offersLoading} offerLabel={label}/>;
        })}</div>
      </section>}
      {accountProfile.role === "business_owner" && <section className="savedSection" id="saved-creators"><div className="dashboardSubhead"><h3>Saved creators</h3><span>{savedCreatorIds.length}</span></div>
        {!savedCreatorIds.length && <p className="muted">Save creators you may want to work with later.</p>}
        <div className="savedCreatorList">{savedCreatorIds.map(id=>{const creator=creatorList.find(item=>item.id===id);return creator?<CreatorCard key={id} creator={creator} saved sent={false} canCollaborate saving={savingCreatorId===id} onSave={()=>toggleSavedCreator(creator)} onView={()=>setSelected(creator)} onSend={()=>sendRequest(creator)}/>:null})}</div>
      </section>}
      <div className="dashboardRequests"><h3>{accountProfile.role === "creator" ? "Collaboration Requests" : "My Collaboration Requests"}</h3>
        <div id="my-requests"/>
        {creatorProfileRequestsError && <p className="businessError" role="alert">{creatorProfileRequestsError}</p>}
        {!requests.length && !creatorProfileRequests.length && !creatorProfileRequestsError && <p className="empty">No collaboration requests yet.</p>}
        {creatorProfileRequests.map(request=><article className="requestItem" key={`creator-profile-${request.id}`}>
          <div><strong>{accountProfile.role === "creator" ? request.business_name : request.creator_name}</strong><small>{accountProfile.role === "creator" ? "Business owner" : "Registered creator"}</small></div>
          <div><strong>{money(Number(request.proposed_budget))}</strong><small>Proposed budget</small></div>
          <div className="requestCampaign"><strong>Creator profile request</strong><small>{request.message}</small></div>
          <span className={`requestStatus ${request.status}`}>{request.status}</span>
          <small>{new Date(request.created_at).toLocaleDateString()}</small>
          <div className="requestActions">
            {accountProfile.role === "creator" && request.status === "pending" && <><button className="primary" onClick={()=>respondToCreatorProfileRequest(request.id,"accepted")}>Accept</button><button className="outline" onClick={()=>respondToCreatorProfileRequest(request.id,"rejected")}>Reject</button></>}
          </div>
        </article>)}
        {requests.map(request=><article className="requestItem" key={request.id}>
          <div><strong>{accountProfile.role === "creator" ? request.shopOwner : request.creator?.name || "Creator"}</strong><small>{accountProfile.role === "creator" ? "Business owner" : `${request.creator?.niche || "Creator"} · ${request.creator?.city || ""}`}</small></div>
          <div><strong>{money(Number(request.proposed_budget))}</strong><small>Proposed budget</small></div>
          <div className="requestCampaign"><strong>{request.campaign_name || "Collaboration"}</strong><small>{request.product_service || request.message}</small></div>
          <span className={`requestStatus ${request.status}`}>{request.status}</span>
          <small>{new Date(request.created_at).toLocaleDateString()}</small>
          <p className="requestMessage">{request.campaign_description || request.message}<br/><small>{request.deliverables || "Deliverables not specified"}{request.preferred_date ? ` · ${new Date(request.preferred_date).toLocaleDateString()}` : ""}</small></p>
          <div className="requestActions">
            {accountProfile.role === "creator" && request.status === "pending" && <><button className="primary" onClick={()=>updateRequestStatus(request.id,"accepted")}>Accept</button><button className="outline" onClick={()=>updateRequestStatus(request.id,"rejected")}>Reject</button></>}
            {request.status === "accepted" && <button className="outline" onClick={()=>setActiveChat(request)}>Messages <MessageCircle/></button>}
            {request.status === "accepted" && <button className="outline" onClick={()=>updateRequestStatus(request.id,"completed")}>Mark completed</button>}
            {request.status === "completed" && <form className="inlineReview" onSubmit={submitReview}><input type="hidden" name="collaboration_id" value={request.id}/><select name="rating" aria-label="Review rating" defaultValue="5">{[5,4,3,2,1].map(value=><option key={value} value={value}>{value} stars</option>)}</select><input name="review" placeholder="Write a review (optional)"/><button className="outline">Review</button></form>}
          </div>
        </article>)}
      </div>
      <section className="messageSection" id="legacy-messages"><div className="dashboardSubhead"><h3>Legacy request messages</h3><span>{requests.filter(request=>["accepted","completed"].includes(request.status)).length} conversations</span></div>
        {!activeChat && <p className="muted">Open a conversation from an accepted collaboration request.</p>}
        {activeChat && <div className="chatPanel"><div className="chatHeading"><div><strong>{accountProfile.role==="creator"?activeChat.shopOwner:activeChat.creator?.name}</strong><small>{activeChat.campaign_name || "Collaboration"} · {activeChat.status}</small></div><button className="outline" onClick={()=>setActiveChat(null)}>Close</button></div>
          <div className="chatMessages">{messagesLoading && <p className="muted">Loading messages…</p>}{messagesError && <p className="formError">{messagesError}</p>}{messages.map(message=><div className={`chatMessage ${message.sender_id===accountProfile.id?"mine":""}`} key={message.id}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}{!messagesLoading&&!messages.length&&!messagesError&&<p className="muted">No messages yet. Start the conversation.</p>}</div>
          <form className="chatComposer" onSubmit={sendMessage}><input value={messageDraft} onChange={event=>setMessageDraft(event.target.value)} placeholder="Write a message…" maxLength="5000" required/><button className="primary" disabled={!messageDraft.trim()}><Send/> Send</button></form>
        </div>}
      </section>
      </>}
      <section className="creatorOffersSection" id="offers" aria-labelledby="offers-title">
        <div className="businessSectionHeading"><div><span className="eyebrow">{accountProfile.role === "creator" ? "MY OFFERS" : "CREATOR OFFERS"}</span><h3 id="offers-title">{accountProfile.role === "creator" ? "Offers and negotiation" : "Offers from creators"}</h3><p>Review the current proposal and the complete price and terms history. An accepted offer does not create a collaboration.</p></div></div>
        {offersLoading && <p className="businessState" role="status">Loading offers…</p>}
        {offersError && <p className="businessError" role="alert">{offersError}</p>}
        {offerActionError && <p className="businessError" role="alert">{offerActionError}</p>}
        {!offersLoading && !offersError && !creatorOffers.length && <div className="promotionEmpty"><span className="businessEmptyIcon"><Handshake aria-hidden="true"/></span><h4>No offers yet</h4><p>{accountProfile.role === "creator" ? "Find a published opportunity and submit an offer with your price and proposed terms." : "Creator offers for your published listings will appear here."}</p></div>}
        {!offersLoading && creatorOffers.length > 0 && <div className="creatorOffersList">
          {creatorOffers.map(offer=><CreatorOfferCard key={offer.id} offer={offer} role={accountProfile.role} busy={offerActionBusy === offer.id} counterOpen={counterOfferId === offer.id} counterError={counterOfferId === offer.id ? counterOfferError : ""} onAction={respondToOffer} onCounterToggle={id=>{setCounterOfferError("");setOfferActionError("");setCounterOfferId(current=>current === id ? "" : id);}} onCounterSubmit={submitCounteroffer}/>)}
        </div>}
      </section>
      <section className="managedCollaborationsSection" id="collaborations" aria-labelledby="managed-collaborations-title">
        <div className="businessSectionHeading"><div><span className="eyebrow">COLLABORATIONS</span><h3 id="managed-collaborations-title">Agreed campaigns</h3><p>Offer terms become a collaboration only after both the business and creator confirm the date and details. Payments are not processed by CreatorConnect.</p></div></div>
        {collaborationsLoading && <p className="businessState" role="status">Loading collaborations…</p>}
        {collaborationsError && <p className="businessError" role="alert">{collaborationsError}</p>}
        {!collaborationsLoading && !collaborationsError && !creatorCollaborations.length && <div className="promotionEmpty"><span className="businessEmptyIcon"><Handshake aria-hidden="true"/></span><h4>No collaborations yet</h4><p>Once an accepted offer's participants begin confirmation, its shared campaign details will appear here.</p></div>}
        {!collaborationsError && creatorCollaborations.length > 0 && <div className="managedCollaborationsList">
          {creatorCollaborations.map(collaboration=><CreatorCollaborationCard key={collaboration.id}
            collaboration={collaboration} role={accountProfile.role}
            agreedDate={collaborationDateDrafts[collaboration.id]}
            busy={collaborationActionBusy === collaboration.id}
            onDateChange={(id, date)=>setCollaborationDateDrafts(current=>({...current,[id]:date}))}
            onConfirm={confirmOfferCollaboration} onStatus={updateCreatorCollaboration}
            onOpenMessages={item=>{setActiveCreatorCollaboration(item);document.getElementById("messages")?.scrollIntoView({behavior:"smooth",block:"start"});}}/>)}
        </div>}
      </section>
      <section className="messageSection collaborationMessagesSection" id="messages" aria-labelledby="collaboration-messages-title">
        <div className="dashboardSubhead"><h3 id="collaboration-messages-title">Collaboration messages</h3><span>{creatorCollaborations.filter(item=>["confirmed","in_progress","completed","disputed"].includes(item.status)).length} conversations</span></div>
        {creatorCollaborations.filter(item=>["confirmed","in_progress","completed","disputed"].includes(item.status)).length > 0 && <div className="collaborationConversationList" aria-label="Your collaboration conversations">
          {creatorCollaborations.filter(item=>["confirmed","in_progress","completed","disputed"].includes(item.status)).map(item=><button type="button" className={`outline ${activeCreatorCollaboration?.id===item.id?"selected":""}`} key={item.id} onClick={()=>setActiveCreatorCollaboration(item)}>
            <strong>{item.listing_title}</strong><span>{accountProfile.role === "business_owner" ? item.creator_name : item.business_name} · {item.status.replaceAll("_", " ")}</span>
          </button>)}
        </div>}
        {!activeCreatorCollaboration && <p className="muted">Choose a confirmed collaboration to view its private conversation.</p>}
        {activeCreatorCollaboration && <div className="chatPanel">
          <div className="chatHeading"><div><strong>{activeCreatorCollaboration.listing_title}</strong><small>{accountProfile.role === "business_owner" ? activeCreatorCollaboration.creator_name : activeCreatorCollaboration.business_name} · {activeCreatorCollaboration.status.replaceAll("_", " ")}</small></div><button className="outline" type="button" onClick={()=>setActiveCreatorCollaboration(null)}>Close</button></div>
          <div className="chatMessages">
            {creatorMessagesLoading && <p className="muted" role="status">Loading messages…</p>}
            {creatorMessagesError && <p className="formError" role="alert">{creatorMessagesError}</p>}
            {!creatorMessagesLoading && !creatorMessagesError && !creatorCollaborationMessages.length && <p className="muted">No messages yet. Start the conversation.</p>}
            {creatorCollaborationMessages.map(message=><div className={`chatMessage ${message.sender_id===accountProfile.id?"mine":""}`} key={message.id}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}
          </div>
          <form className="chatComposer" onSubmit={sendCreatorCollaborationMessage}>
            <input value={creatorMessageDraft} onChange={event=>setCreatorMessageDraft(event.target.value)} placeholder="Write a message…" maxLength="5000" aria-label="Collaboration message" required/>
            <button className="primary" disabled={!creatorMessageDraft.trim() || creatorMessageSending || !creatorConversationId}><Send/> {creatorMessageSending ? "Sending…" : "Send"}</button>
          </form>
        </div>}
      </section>
    </section>}

    {selected && <Modal onClose={()=>setSelected(null)}><div className="profileModal" role="dialog" aria-modal="true" aria-labelledby="creator-profile-dialog-title">{selected.image && <img src={selected.image} alt=""/>}{selected.avatar && <img className="avatarBig" src={selected.avatar} alt={`${selected.name} avatar`}/>}<h2 id="creator-profile-dialog-title">{selected.name} {selected.verified && <span className="verified">✓</span>}</h2>{selected.isDemo && <span className="demoBadge modalDemoBadge">DEMO PROFILE · NOT VERIFIED</span>}{selected.isRegisteredProfile && <span className="registeredBadge">REGISTERED CREATOR</span>}{selected.channelName && selected.channelName !== selected.name && <p>{selected.channelName}</p>}<p>{selected.niche} · {selected.city}{selected.state ? `, ${selected.state}` : ""}</p><div className="stats"><Stat n={formatSubscribers(selected.subscriberCount)} t="Subscribers"/><Stat n={selected.averageViews == null ? "Not provided" : formatSubscribers(selected.averageViews)} t="Average views"/><Stat n={selected.budget == null ? "Not provided" : money(Number(selected.budget))} t="Collaboration price"/></div><p className="creatorAvailability">Availability: {selected.availability}</p><p className="bio">{selected.bio}</p>{selected.isDemo && <p className="demoDisclosure">This is a locally stored sample profile. Its details are illustrative and are not a verified creator account.</p>}{selected.channelUrl && <a className="channelLink" href={selected.channelUrl} target="_blank" rel="noreferrer"><ExternalLink/> YouTube Channel</a>}{(selected.isDemo || accountProfile?.role === "business_owner") && <button className="primary wide" onClick={()=>sendRequest(selected)}>{selected.isDemo ? <><Send/> Request Collaboration</> : requests.some(request=>request.creator_id===selected.id && request.status!=="rejected") || creatorProfileRequests.some(request=>request.creator_user_id===selected.userId && request.business_user_id===accountProfile?.id && request.status==="pending") ? <><CheckCircle2/> Request Sent</>:<><Send/> Send Collaboration Request</>}</button>}</div></Modal>}

    {offerListing && <Modal onClose={()=>{if (!offerSubmitting) {setOfferListing(null);setOfferSubmitError("");}}}><div className="roleModal offerModal" role="dialog" aria-modal="true" aria-labelledby="creator-offer-dialog-title">
      <button type="button" className="close" aria-label="Close offer form" disabled={offerSubmitting} onClick={()=>{setOfferListing(null);setOfferSubmitError("");}}><X/></button>
      <h2 id="creator-offer-dialog-title">Make an offer</h2>
      <p>Send your proposed price and terms to {offerListing.business_name}. Offers are not collaborations; the business must accept your proposal for terms to be agreed.</p>
      <form className="form" onSubmit={submitCreatorOffer}>
        <label>Proposed price (₹)<input name="proposed_price" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={offerListing.budget_max ?? offerListing.budget_min ?? creatorProfile?.minimum_fee ?? ""} required/></label>
        <label>Message<textarea name="offer_message" maxLength="4000" rows="3" required/></label>
        <label>Proposed deliverables<textarea name="offer_deliverables" maxLength="4000" rows="3" defaultValue={offerListing.deliverables || ""} required/></label>
        <label>Proposed schedule (optional)<textarea name="offer_schedule" maxLength="1000" rows="2" placeholder="Suggest dates or timing that work for you"/></label>
        {offerSubmitError && <p className="businessError" role="alert">{offerSubmitError}</p>}
        <button type="submit" className="primary wide" disabled={offerSubmitting}>{offerSubmitting ? "Submitting offer…" : "Submit offer"}</button>
      </form>
    </div></Modal>}

    {requestCreator && <Modal onClose={()=>setRequestCreator(null)}><div className="roleModal requestModal"><button className="close" onClick={()=>setRequestCreator(null)}><X/></button><h2>Request a Collaboration</h2><p>Send your request to {requestCreator.name}.</p><form className="form" onSubmit={submitRequest}><label>Proposed Budget (₹)<input name="proposed_budget" type="number" min="0" step="1" defaultValue={requestCreator.budget ?? ""} required/></label><label>Message<textarea name="message" maxLength="5000" defaultValue="I would like to collaborate with you to promote my business." required/></label>{requestSubmitError && <p className="formError" role="alert">{requestSubmitError}</p>}<button className="primary wide" disabled={submitting}><Send/> {submitting ? "Sending..." : "Send Collaboration Request"}</button></form></div></Modal>}

    {role && <Modal onClose={()=>{setRole(null);setAuthError("");setAuthNotice("")}}><div className="roleModal" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
      <button type="button" className="close" aria-label="Close" onClick={()=>{setRole(null);setAuthError("");setAuthNotice("")}}><X/></button>
      <h2 id="auth-dialog-title">{role === "login" ? "Welcome Back" : role === "forgot-password" ? "Reset your password" : role === "reset-password" ? "Choose a new password" : role === "check-email" ? "Verify your email" : role === "reset-email-sent" ? "Check your inbox" : isEditingProfile ? "Edit your account" : role === "signup" ? "Create Your Account" : activeRegistrationRole === "creator" ? "YouTuber / Creator Account" : "Business Owner Account"}</h2>
      <p>{role === "login" ? "Log in securely with your email and password." : role === "forgot-password" ? "We'll email you a secure link to choose a new password." : role === "reset-password" ? "Choose a new password for your account." : role === "check-email" ? `We sent a verification link to ${authEmail}. Verify your address before logging in.` : role === "reset-email-sent" ? `If an account exists for ${authEmail}, a password reset link is on its way.` : isEditingProfile ? "Update the name and phone number on your account." : "Create an account to get started."}</p>
      {profileLoading && <p role="status">Loading your account…</p>}
      {profileLoadError && session && <p className="formError" role="alert">{profileLoadError}</p>}
      {role === "login" && <form className="form" onSubmit={handleAuthSubmit}>
        <label>Email address<input name="email" type="email" autoComplete="email" required/></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" minLength="6" required/></label>
        {authError && <p className="formError" role="alert">{authError}</p>}
        <button className="primary wide" disabled={submitting}>{submitting ? "Logging in..." : "Log in"}</button>
        <button type="button" className="outline wide" onClick={()=>{setAuthError("");setRole("forgot-password")}}>Forgot password?</button>
      </form>}
      {(role === "signup" || role === "creator" || role === "business_owner") && !isEditingProfile && <form className="form" onSubmit={handleAuthSubmit}>
        {role === "signup" && <label>Account type<select name="account_role" value={registrationRole} onChange={event=>setRegistrationRole(event.target.value)}><option value="business_owner">Business Owner</option><option value="creator">YouTuber / Creator</option></select></label>}
        <label>{registrationRole === "creator" ? "Full name" : "Business name"}<input name="full_name" autoComplete="name" required/></label>
        <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel"/></label>
        <label>Email address<input name="email" type="email" autoComplete="email" required/></label>
        <label>Password (at least 8 characters)<input name="password" type="password" autoComplete="new-password" minLength="8" required/></label>
        {authError && <p className="formError" role="alert">{authError}</p>}
        <button className="primary wide" disabled={submitting}>{submitting ? "Creating account..." : "Create account"}</button>
        <button type="button" className="outline wide" onClick={()=>{setAuthError("");setRole("login")}}>Already have an account? Log in</button>
      </form>}
      {role === "forgot-password" && <form className="form" onSubmit={handleForgotPassword}>
        <label>Email address<input name="email" type="email" autoComplete="email" defaultValue={authEmail} required/></label>
        {authError && <p className="formError" role="alert">{authError}</p>}
        <button className="primary wide" disabled={submitting}>{submitting ? "Sending link..." : "Send reset link"}</button>
        <button type="button" className="outline wide" onClick={()=>{setAuthError("");setRole("login")}}>Back to log in</button>
      </form>}
      {role === "reset-password" && <form className="form" onSubmit={handlePasswordReset}>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength="8" required/></label>
        <label>Confirm new password<input name="password_confirmation" type="password" autoComplete="new-password" minLength="8" required/></label>
        {authError && <p className="formError" role="alert">{authError}</p>}
        <button className="primary wide" disabled={submitting}>{submitting ? "Updating password..." : "Update password"}</button>
      </form>}
      {(role === "check-email" || role === "reset-email-sent") && <>
        {authNotice && <p className="authNotice" role="status">{authNotice}</p>}
        {authError && <p className="formError" role="alert">{authError}</p>}
        {role === "check-email" && <button type="button" className="outline wide" disabled={submitting} onClick={resendVerificationEmail}>{submitting ? "Sending..." : "Resend verification email"}</button>}
        <button type="button" className="outline wide authBackButton" onClick={()=>{setAuthError("");setRole("login")}}>Back to log in</button>
      </>}
      {isEditingProfile && <form className="form" onSubmit={handleProfileSave}>
        <label>Full name<input name="full_name" autoComplete="name" defaultValue={accountProfile.full_name} required/></label>
        <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={accountProfile.phone || ""}/></label>
        {authError && <p className="formError" role="alert">{authError}</p>}
        <button className="primary wide" disabled={submitting}>{submitting ? "Saving..." : "Save account details"}</button>
      </form>}
      {role === "login" && <button type="button" className="outline wide authBackButton" onClick={()=>{setAuthError("");setRole("signup")}}>Need an account? Sign up</button>}
    </div></Modal>}

    {toast && <div className="toast">{toast}</div>}
  </div>
}

function CreatorCard({creator,onView,onSend,sent,canCollaborate}){
 return <article className={`card creatorCard ${creator.isDemo ? "demoCreatorCard" : ""}`}><div className="cover"><img src={creator.image} alt=""/><span className="niche">{creator.niche}</span><img className="avatar" src={creator.avatar} alt={`${creator.name} avatar`}/>{creator.isDemo && <span className="demoBadge cardDemoBadge">DEMO</span>}{creator.isRegisteredProfile && <span className="registeredBadge cardRegisteredBadge">REGISTERED</span>}</div><div className="cardBody"><h3>{creator.name} {creator.verified && <span className="verified">✓</span>}</h3>{creator.channelName && creator.channelName !== creator.name && <p className="creatorChannelName">{creator.channelName}</p>}<p className="creatorCardCity"><MapPin aria-hidden="true"/>{creator.city}{creator.state ? `, ${creator.state}` : ""}</p><p className={`creatorAvailability ${creator.availability}`}>Availability: {creator.availability}</p><div className="metrics"><div><b>{formatSubscribers(creator.subscriberCount)}</b><small>Subscribers</small></div><div><b>{creator.averageViews == null ? "Not provided" : formatSubscribers(creator.averageViews)}</b><small>Avg. Views</small></div><div><b>{creator.budget == null ? "Not provided" : money(Number(creator.budget))}</b><small>Collab. Price</small></div></div>{creator.channelUrl && <a className="creatorChannelLink" href={creator.channelUrl} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>YouTube channel <ExternalLink aria-hidden="true"/></a>}<div className="cardBtns"><button className="outline" onClick={onView}>View Profile</button><button className="primary" disabled={!canCollaborate} onClick={onSend}>{!canCollaborate?"Business Owners Only":creator.isDemo?"Request Collaboration":sent?"Sent":"Collaborate"}</button></div></div></article>
}
function Feature({icon,title,text}){return <div className="feature"><div className="featureIcon">{icon}</div><div><b>{title}</b><small>{text}</small></div></div>}
function Stat({n,t}){return <div><b>{n}</b><small>{t}</small></div>}
function Modal({children,onClose}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>{children}</div>}

const root = createRoot(document.getElementById("root"));
root.render(<App/>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());