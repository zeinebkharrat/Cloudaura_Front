export interface Event {
  eventId?: number;      
  title: string;
  eventType: string;
  startDate: string;
  endDate: string;
  venue: string;
  status: string;
  city?: {
    cityId: number;
    cityName?: string;
  };
}