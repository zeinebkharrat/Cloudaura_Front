package org.example.backend.model;
 
import jakarta.persistence.*;
import java.util.Date;
 
@Entity
@Table(name = "activity_reservations")
public class ActivityReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer activityReservationId;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id")
    private Activity activity;
 
    private Date reservationDate;
    private Integer numberOfPeople;
    private Double totalPrice;
 
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
 
    public ActivityReservation() {}
 
    public Integer getActivityReservationId() { return activityReservationId; }
    public void setActivityReservationId(Integer id) { this.activityReservationId = id; }
    public User getUser() { return user; }
    public void setUser(User u) { this.user = u; }
    public Activity getActivity() { return activity; }
    public void setActivity(Activity a) { this.activity = a; }
    public Date getReservationDate() { return reservationDate; }
    public void setReservationDate(Date d) { this.reservationDate = d; }
    public Integer getNumberOfPeople() { return numberOfPeople; }
    public void setNumberOfPeople(Integer n) { this.numberOfPeople = n; }
    public Double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(Double p) { this.totalPrice = p; }
    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus s) { this.status = s; }
}
