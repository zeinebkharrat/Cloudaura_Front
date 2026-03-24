import os
import shutil
import re

base_dir = r"d:\yallatn\backend\src\main\java\org\example\backend"

layers = ['model', 'repository', 'service', 'controller', 'dto', 'security', 'config']
for l in layers:
    os.makedirs(os.path.join(base_dir, l), exist_ok=True)

# 1. Delete CMS completely
cms_dir = os.path.join(base_dir, "cms")
if os.path.exists(cms_dir): shutil.rmtree(cms_dir)

# 2. Extract and Move Files to layered Architecture
for root, dirs, files in os.walk(base_dir):
    if root == base_dir or any(root.startswith(os.path.join(base_dir, l)) for l in layers) or 'cms' in root:
        continue
    for f in files:
        if not f.endswith(".java"): continue
        src = os.path.join(root, f)
        dest_layer = "service"
        if "repo" in root.lower() or f.endswith("Repository.java"): dest_layer = "repository"
        elif "dto" in root.lower(): dest_layer = "dto"
        elif "model" in root.lower(): dest_layer = "model"
        elif "security" in root.lower(): dest_layer = "security"
        elif "config" in root.lower(): dest_layer = "config"
        elif f.endswith("Controller.java"): dest_layer = "controller"
        elif f.endswith("Service.java") or f.endswith("ServiceImpl.java"): dest_layer = "service"
        
        shutil.copy(src, os.path.join(base_dir, dest_layer, f))
        try: os.remove(src)
        except: pass

# Clean empty directories
for root, dirs, files in os.walk(base_dir, topdown=False):
    for d in dirs:
        if d not in layers:
            pd = os.path.join(root, d)
            try: os.rmdir(pd)
            except: pass

# 3. Refactor imports and packages
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if not f.endswith(".java"): continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        layer = os.path.basename(os.path.dirname(path))
        if layer in layers:
            content = re.sub(r"package\s+org\.example\.backend\.[a-z0-9_.]*;", f"package org.example.backend.{layer};", content)
        
        # fix imports targeting old packages
        content = re.sub(r"import\s+org\.example\.backend\.[a-z0-9_]+\.model\.", "import org.example.backend.model.", content)
        content = re.sub(r"import\s+org\.example\.backend\.[a-z0-9_]+\.repository\.", "import org.example.backend.repository.", content)
        content = re.sub(r"import\s+org\.example\.backend\.[a-z0-9_]+\.dto\.", "import org.example.backend.dto.", content)
        
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)

# 4. Remove all existing files in 'model'
model_dir = os.path.join(base_dir, "model")
for f in os.listdir(model_dir):
    if f.endswith(".java"):
        os.remove(os.path.join(model_dir, f))

# 5. Generate New Models based on PlantUML
models = {
    "Role.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="roles")
public class Role {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer roleId;
    private String name;
}""",
    "Level.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="levels")
public class Level {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer levelId;
    private String name;
    private Integer minPoints;
    private Integer maxPoints;
}""",
    "UserPreference.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="user_preferences")
public class UserPreference {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer preferenceId;
    @OneToOne @JoinColumn(name="user_id")
    private User user;
    private Double budgetMin;
    private Double budgetMax;
    private String travelStyle;
    private String preferredRegion;
    private String preferredCuisine;
    private String transportPreference;
    private String accommodationType;
    private String travelWith;
}""",
    "Ban.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="bans")
public class Ban {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer banId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private String reason;
    private Date createdAt;
    private Date expiresAt;
    private Boolean isActive;
}""",
    "User.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
import java.util.Set;
@Data @Entity @Table(name="users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer userId;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String passwordHash;
    private String phone;
    private Integer points;
    
    @ManyToOne @JoinColumn(name="level_id")
    private Level level;
    
    private String status;
    private Date createdAt;
    
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles;
}""",
    "AuthLog.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="auth_logs")
public class AuthLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer authLogId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private String loginMethod;
    private String ipAddress;
    private String device;
    private String status;
    private Date timestamp;
}""",
    "Notification.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="notifications")
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer notificationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private String title;
    private String message;
    private Boolean isRead;
    private Date createdAt;
}""",
    "UserRoadmapCompletion.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="user_roadmap_completions")
public class UserRoadmapCompletion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer completionId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="node_id")
    private RoadmapNode roadmapNode;
    private Date completedAt;
    private Integer score;
    private Integer maxScore;
}""",
    "RoadmapNode.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="roadmap_nodes")
public class RoadmapNode {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer nodeId;
    private Integer stepOrder;
    private String nodeLabel;
    @ManyToOne @JoinColumn(name="quiz_id")
    private Quiz quiz;
    @ManyToOne @JoinColumn(name="crossword_id")
    private Crossword crossword;
}""",
    "Quiz.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="quizzes")
public class Quiz {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer quizId;
    private String title;
    private String description;
    private Boolean published;
    private Date createdAt;
}""",
    "QuizQuestion.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="quiz_questions")
public class QuizQuestion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer questionId;
    @ManyToOne @JoinColumn(name="quiz_id")
    private Quiz quiz;
    private Integer orderIndex;
    private String questionText;
    private String imageUrl;
    @Lob @Column(columnDefinition="TEXT")
    private String optionsJson;
    private Integer correctOptionIndex;
}""",
    "Crossword.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="crosswords")
public class Crossword {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer crosswordId;
    private String title;
    private String description;
    private Boolean published;
    private Date createdAt;
    @Lob @Column(columnDefinition="TEXT")
    private String gridJson;
}""",
    "MediaType.java": """package org.example.backend.model;
public enum MediaType { IMAGE, VIDEO, PANORAMA }""",
    "ReservationStatus.java": """package org.example.backend.model;
public enum ReservationStatus { PENDING, CONFIRMED, CANCELLED }""",
    "OrderStatus.java": """package org.example.backend.model;
public enum OrderStatus { PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED }""",
    "City.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="cities")
public class City {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cityId;
    private String name;
    private String region;
    @Lob @Column(columnDefinition="TEXT")
    private String description;
    private Double latitude;
    private Double longitude;
}""",
    "CityMedia.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="city_media")
public class CityMedia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer mediaId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String url;
    @Enumerated(EnumType.STRING)
    private MediaType mediaType;
}""",
    "SpecialOffer.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="special_offers")
public class SpecialOffer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer offerId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String title;
    private String description;
    private Double discountPercentage;
    private Date startDate;
    private Date endDate;
}""",
    "Restaurant.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="restaurants")
public class Restaurant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer restaurantId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    private String cuisineType;
    private Double rating;
}""",
    "Activity.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="activities")
public class Activity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer activityId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    private String type;
    private Double price;
}""",
    "Accommodation.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="accommodations")
public class Accommodation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer accommodationId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    private String type;
    private Double pricePerNight;
    private Double rating;
    private String status;
}""",
    "Room.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="rooms")
public class Room {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer roomId;
    @ManyToOne @JoinColumn(name="accommodation_id")
    private Accommodation accommodation;
    private String roomType;
    private Double price;
    private Integer capacity;
}""",
    "Reservation.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="reservations")
public class Reservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer reservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="room_id")
    private Room room;
    private Date checkInDate;
    private Date checkOutDate;
    private Double totalPrice;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}""",
    "Transport.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="transports")
public class Transport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer transportId;
    @ManyToOne @JoinColumn(name="departure_city_id")
    private City departureCity;
    @ManyToOne @JoinColumn(name="arrival_city_id")
    private City arrivalCity;
    private String type;
    private Date departureTime;
    private Date arrivalTime;
    private Double price;
    private Integer capacity;
}""",
    "TransportReservation.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="transport_reservations")
public class TransportReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer transportReservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="transport_id")
    private Transport transport;
    private Date travelDate;
    private Double totalPrice;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}""",
    "Event.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="events")
public class Event {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer eventId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String title;
    private String eventType;
    private Date startDate;
    private Date endDate;
    private String venue;
    private String status;
}""",
    "TicketType.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="ticket_types")
public class TicketType {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer ticketTypeId;
    @ManyToOne @JoinColumn(name="event_id")
    private Event event;
    private String name;
    private Double price;
    private Integer totalQuantity;
}""",
    "EventReservation.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="event_reservations")
public class EventReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer eventReservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="event_id")
    private Event event;
    private Double totalAmount;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}""",
    "EventReservationItem.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="event_reservation_items")
public class EventReservationItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer reservationItemId;
    @ManyToOne @JoinColumn(name="event_reservation_id")
    private EventReservation eventReservation;
    @ManyToOne @JoinColumn(name="ticket_type_id")
    private TicketType ticketType;
    private Integer quantity;
}""",
    "ActivityReservation.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="activity_reservations")
public class ActivityReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer activityReservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="activity_id")
    private Activity activity;
    private Date reservationDate;
    private Integer numberOfPeople;
    private Double totalPrice;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}""",
    "Product.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="products")
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer productId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private String name;
    private Double price;
    private Integer stock;
}""",
    "Cart.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="carts")
public class Cart {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cartId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private Date createdAt;
}""",
    "CartItem.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="cart_items")
public class CartItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cartItemId;
    @ManyToOne @JoinColumn(name="cart_id")
    private Cart cart;
    @ManyToOne @JoinColumn(name="product_id")
    private Product product;
    private Integer quantity;
}""",
    "OrderEntity.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="orders")
public class OrderEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private Double totalAmount;
    @Enumerated(EnumType.STRING)
    private OrderStatus status;
}""",
    "OrderItem.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="order_items")
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderItemId;
    @ManyToOne @JoinColumn(name="order_id")
    private OrderEntity order;
    @ManyToOne @JoinColumn(name="product_id")
    private Product product;
    private Integer quantity;
}""",
    "Post.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="posts")
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer postId;
    @ManyToOne @JoinColumn(name="author_id")
    private User author;
    @Lob @Column(columnDefinition="TEXT")
    private String content;
    private String location;
    private String visibility;
    private Integer likesCount;
    private Integer commentsCount;
    private Date createdAt;
    private Date updatedAt;
}""",
    "PostMedia.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="post_media")
public class PostMedia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer mediaId;
    @ManyToOne @JoinColumn(name="post_id")
    private Post post;
    private String fileUrl;
    @Enumerated(EnumType.STRING)
    private MediaType mediaType;
    private Integer orderIndex;
}""",
    "LikeEntity.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="likes")
public class LikeEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer likeId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="post_id")
    private Post post;
    private Date createdAt;
}""",
    "Comment.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="comments")
public class Comment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer commentId;
    @ManyToOne @JoinColumn(name="post_id")
    private Post post;
    @ManyToOne @JoinColumn(name="author_id")
    private User author;
    @ManyToOne @JoinColumn(name="parent_id")
    private Comment parent;
    @Lob @Column(columnDefinition="TEXT")
    private String content;
    private Date createdAt;
    private Date updatedAt;
}""",
    "ChatRoom.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="chat_rooms")
public class ChatRoom {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer chatRoomId;
    private String name;
    private Date createdAt;
}""",
    "Message.java": """package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="messages")
public class Message {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer messageId;
    @ManyToOne @JoinColumn(name="chat_room_id")
    private ChatRoom chatRoom;
    @ManyToOne @JoinColumn(name="sender_id")
    private User sender;
    @Lob @Column(columnDefinition="TEXT")
    private String content;
    private Date sentAt;
}""",
}

for filename, content in models.items():
    with open(os.path.join(model_dir, filename), 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Refactoring complete: created {len(models)} model files and layered the architecture.")
