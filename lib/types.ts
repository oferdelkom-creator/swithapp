export type UserRole = "private" | "dealer" | "importer";
export type BillingPlan = "subscription" | "per_listing";
export type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric" | "Gas";
export type CarRegion =
  | "North"
  | "Haifa"
  | "Center"
  | "Tel Aviv"
  | "Jerusalem"
  | "Shfela"
  | "South"
  | "Judea and Samaria";
export type MatchStatus = "negotiating" | "closed";
export type SwipeDirection = "left" | "right";
export type MessageKind = "report" | "hello";

export interface AppUser {
  id: string;
  name: string;
  avatar_url: string | null;
  lat: number | null;
  lon: number | null;
  role: UserRole;
  business_name: string | null;
  billing_plan: BillingPlan | null;
  subscription_valid_until: string | null;
  premium_until: string | null;
  accepts_hello_messages: boolean;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface UserContact {
  user_id: string;
  phone: string;
}

export interface Car {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  transmission: string | null;
  category: string | null;
  color: string | null;
  photo_urls: string[];
  price: number | null;
  hand: number | null;
  fuel_type: FuelType | null;
  region: CarRegion | null;
  for_sale: boolean;
  for_swap: boolean;
  want_make: string | null;
  want_model: string | null;
  want_notes: string | null;
  listing_fee_paid: boolean;
  boosted_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Swipe {
  id: string;
  from_user_id: string;
  to_user_id: string;
  car_id: string;
  direction: SwipeDirection;
  created_at: string;
}

export interface Match {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: MatchStatus;
  user_a_agreed_to_call: boolean;
  user_b_agreed_to_call: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  text: string;
  kind: MessageKind;
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}
