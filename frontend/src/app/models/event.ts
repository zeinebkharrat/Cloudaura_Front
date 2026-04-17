export interface City {
  cityId: number;
  name?: string;
  region?: string;
}

export interface Event {
  eventId?: number;
  title: string;
  eventType: string;
  startDate: string;
  endDate: string;
  venue: string;
  status: string;
  imageUrl?: string;
  price?: number;
  totalCapacity?: number;
  reservedCount?: number;
  city: City;
  
}