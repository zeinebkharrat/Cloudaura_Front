package org.example.backend.service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.example.backend.dto.shop.AddToCartRequest;
import org.example.backend.dto.shop.UpdateCartItemRequest;
import org.example.backend.dto.shop.CheckoutBuyerDto;
import org.example.backend.dto.shop.CheckoutOrderDto;
import org.example.backend.dto.shop.MyOrderSummaryDto;
import org.example.backend.dto.shop.OrderLineDto;
import org.example.backend.dto.shop.ShopCartDto;
import org.example.backend.dto.shop.ShopCartLineDto;
import org.example.backend.model.Cart;
import org.example.backend.model.CartItem;
import org.example.backend.model.OrderEntity;
import org.example.backend.model.OrderItem;
import org.example.backend.model.OrderStatus;
import org.example.backend.model.Product;
import org.example.backend.model.User;
import org.example.backend.repository.CartItemRepository;
import org.example.backend.repository.CartRepository;
import org.example.backend.repository.OrderEntityRepository;
import org.example.backend.repository.OrderItemRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ShopService {

    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final OrderEntityRepository orderEntityRepository;
    private final OrderItemRepository orderItemRepository;

    public ShopService(
        UserRepository userRepository,
        CartRepository cartRepository,
        CartItemRepository cartItemRepository,
        ProductRepository productRepository,
        OrderEntityRepository orderEntityRepository,
        OrderItemRepository orderItemRepository
    ) {
        this.userRepository = userRepository;
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.productRepository = productRepository;
        this.orderEntityRepository = orderEntityRepository;
        this.orderItemRepository = orderItemRepository;
    }

    public ShopCartDto getCart(String username) {
        if (username == null || username.isBlank()) {
            return newEmptyCart();
        }
        return userRepository.findByUsernameIgnoreCase(username.trim())
            .flatMap(u -> cartRepository.findByUser_UserId(u.getUserId()))
            .map(this::toCartDto)
            .orElseGet(this::newEmptyCart);
    }

    @Transactional
    public ShopCartDto addToCart(String username, AddToCartRequest request) {
        if (request.getProductId() == null || request.getQuantity() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "productId et quantity requis");
        }
        int qty = request.getQuantity();
        if (qty <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantity > 0");
        }
        User user = findUser(username);
        Product product = productRepository.findById(request.getProductId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produit introuvable"));
        int stock = product.getStock() != null ? product.getStock() : 0;
        if (stock < qty) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuffisant");
        }

        Cart cart = getOrCreateCart(user);
        CartItem existing = cartItemRepository
            .findByCart_CartIdAndProduct_ProductId(cart.getCartId(), product.getProductId())
            .orElse(null);

        if (existing != null) {
            int newQty = existing.getQuantity() + qty;
            if (newQty > stock) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuffisant pour ce panier");
            }
            existing.setQuantity(newQty);
            cartItemRepository.save(existing);
        } else {
            CartItem line = new CartItem();
            line.setCart(cart);
            line.setProduct(product);
            line.setQuantity(qty);
            cartItemRepository.save(line);
        }
        return toCartDto(cartRepository.findById(cart.getCartId()).orElseThrow());
    }

    @Transactional
    public ShopCartDto removeCartItem(String username, Integer cartItemId) {
        User user = findUser(username);
        CartItem line = cartItemRepository.findById(cartItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne introuvable"));
        Cart cart = line.getCart();
        if (cart == null || cart.getUser() == null
            || !cart.getUser().getUserId().equals(user.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ligne non autorisée");
        }
        cartItemRepository.deleteById(cartItemId);
        return cartRepository.findByUser_UserId(user.getUserId())
            .map(this::toCartDto)
            .orElseGet(this::newEmptyCart);
    }

    @Transactional
    public ShopCartDto updateCartItemQuantity(String username, Integer cartItemId, UpdateCartItemRequest request) {
        if (request.getQuantity() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantity requise");
        }
        int qty = request.getQuantity();
        User user = findUser(username);
        CartItem line = cartItemRepository.findById(cartItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne introuvable"));
        Cart cart = line.getCart();
        if (cart == null || cart.getUser() == null
            || !cart.getUser().getUserId().equals(user.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ligne non autorisée");
        }
        Product product = productRepository.findById(line.getProduct().getProductId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produit introuvable"));

        if (qty <= 0) {
            cartItemRepository.deleteById(cartItemId);
        } else {
            int stock = product.getStock() != null ? product.getStock() : 0;
            if (qty > stock) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuffisant");
            }
            line.setQuantity(qty);
            cartItemRepository.save(line);
        }
        return cartRepository.findByUser_UserId(user.getUserId())
            .map(this::toCartDto)
            .orElseGet(this::newEmptyCart);
    }

    @Transactional
    public CheckoutOrderDto checkout(String username) {
        User user = findUser(username);
        Cart cart = cartRepository.findByUser_UserId(user.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Panier vide"));
        List<CartItem> lines = cartItemRepository.findByCartIdWithProduct(cart.getCartId());
        if (lines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Panier vide");
        }

        double total = 0;
        for (CartItem line : lines) {
            Product p = line.getProduct();
            int qty = line.getQuantity();
            int stock = p.getStock() != null ? p.getStock() : 0;
            if (stock < qty) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Stock insuffisant pour: " + p.getName()
                );
            }
            double price = p.getPrice() != null ? p.getPrice() : 0;
            total += price * qty;
        }

        OrderEntity order = new OrderEntity();
        order.setUser(user);
        order.setTotalAmount(total);
        order.setStatus(OrderStatus.PENDING);
        order.setCreatedAt(new Date());
        order = orderEntityRepository.save(order);

        List<OrderLineDto> outLines = new ArrayList<>();
        for (CartItem line : lines) {
            Product p = line.getProduct();
            int qty = line.getQuantity();
            double price = p.getPrice() != null ? p.getPrice() : 0;

            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setProduct(p);
            oi.setQuantity(qty);
            oi = orderItemRepository.save(oi);

            p.setStock(p.getStock() - qty);
            productRepository.save(p);

            outLines.add(new OrderLineDto(
                oi.getOrderItemId(),
                p.getProductId(),
                p.getName(),
                qty,
                price,
                price * qty
            ));
        }

        cartItemRepository.deleteAll(lines);

        CheckoutOrderDto dto = new CheckoutOrderDto();
        dto.setOrderId(order.getOrderId());
        dto.setStatus(order.getStatus());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setLines(outLines);
        dto.setOrderedAt(formatOrderInstant(order.getCreatedAt()));
        dto.setBuyer(toBuyerDto(user));
        return dto;
    }

    @Transactional(readOnly = true)
    public List<MyOrderSummaryDto> listMyOrders(String username) {
        User u = findUser(username);
        List<OrderEntity> orders = orderEntityRepository.findByUser_UserIdOrderByOrderIdDesc(u.getUserId());
        List<MyOrderSummaryDto> out = new ArrayList<>();
        for (OrderEntity o : orders) {
            MyOrderSummaryDto s = new MyOrderSummaryDto();
            s.setOrderId(o.getOrderId());
            s.setStatus(o.getStatus());
            s.setTotalAmount(o.getTotalAmount());
            s.setOrderedAt(formatOrderInstant(o.getCreatedAt()));
            s.setItemCount((int) orderItemRepository.countByOrder_OrderId(o.getOrderId()));
            out.add(s);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<MyOrderSummaryDto> listArtisanOrders(String username) {
        // We find all order items for this artisan's products
        List<OrderItem> items = orderItemRepository.findByArtisanUsername(username);
        // Group by order to return unique orders
        List<Integer> seenIds = new ArrayList<>();
        List<MyOrderSummaryDto> out = new ArrayList<>();
        for (OrderItem oi : items) {
            OrderEntity o = oi.getOrder();
            if (!seenIds.contains(o.getOrderId())) {
                seenIds.add(o.getOrderId());
                MyOrderSummaryDto s = new MyOrderSummaryDto();
                s.setOrderId(o.getOrderId());
                s.setStatus(o.getStatus());
                s.setTotalAmount(o.getTotalAmount()); // Note: this is the total order amount, not just this artisan's part
                s.setOrderedAt(formatOrderInstant(o.getCreatedAt()));
                s.setItemCount((int) orderItemRepository.countByOrder_OrderId(o.getOrderId()));
                out.add(s);
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public CheckoutOrderDto getMyOrderDetail(String username, Integer orderId) {
        User u = findUser(username);
        OrderEntity order = orderEntityRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
            
        // Check if buyer
        boolean isBuyer = order.getUser() != null && order.getUser().getUserId().equals(u.getUserId());
        
        // Check if artisan of any product in this order
        List<OrderItem> items = orderItemRepository.findByOrderIdWithProduct(orderId);
        boolean isArtisanOfOrder = items.stream()
            .anyMatch(oi -> oi.getProduct() != null && oi.getProduct().getUser() != null && 
                            oi.getProduct().getUser().getUserId().equals(u.getUserId()));

        if (!isBuyer && !isArtisanOfOrder) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refuse");
        }
        
        User buyer = order.getUser();
        List<OrderLineDto> lines = new ArrayList<>();
        for (OrderItem oi : items) {
            Product p = oi.getProduct();
            int qty = oi.getQuantity() != null ? oi.getQuantity() : 0;
            double price = p.getPrice() != null ? p.getPrice() : 0;
            lines.add(new OrderLineDto(
                oi.getOrderItemId(),
                p.getProductId(),
                p.getName(),
                qty,
                price,
                price * qty
            ));
        }
        CheckoutOrderDto dto = new CheckoutOrderDto();
        dto.setOrderId(order.getOrderId());
        dto.setStatus(order.getStatus());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setLines(lines);
        dto.setOrderedAt(formatOrderInstant(order.getCreatedAt()));
        dto.setBuyer(toBuyerDto(buyer));
        return dto;
    }

    private static String formatOrderInstant(Date createdAt) {
        if (createdAt == null) {
            return null;
        }
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(
            createdAt.toInstant().atZone(ZoneId.systemDefault())
        );
    }

    private User findUser(String username) {
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Utilisateur requis");
        }
        String identifier = username.trim();
        return userRepository.findByUsernameIgnoreCase(identifier)
            .or(() -> userRepository.findByEmailIgnoreCase(identifier))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur inconnu"));
    }

    private Cart getOrCreateCart(User user) {
        return cartRepository.findByUser_UserId(user.getUserId()).orElseGet(() -> {
            Cart c = new Cart();
            c.setUser(user);
            c.setCreatedAt(new Date());
            return cartRepository.save(c);
        });
    }

    private ShopCartDto toCartDto(Cart cart) {
        List<CartItem> lines = cartItemRepository.findByCartIdWithProduct(cart.getCartId());
        ShopCartDto dto = new ShopCartDto();
        dto.setCartId(cart.getCartId());
        double total = 0;
        List<ShopCartLineDto> items = new ArrayList<>();
        for (CartItem line : lines) {
            Product p = line.getProduct();
            int qty = line.getQuantity();
            double price = p.getPrice() != null ? p.getPrice() : 0;
            double lineTotal = price * qty;
            total += lineTotal;
            items.add(new ShopCartLineDto(
                line.getCartItemId(),
                p.getProductId(),
                p.getName(),
                p.getImageUrl(),
                price,
                qty,
                lineTotal,
                p.getStock()
            ));
        }
        dto.setItems(items);
        dto.setTotal(total);
        return dto;
    }

    private ShopCartDto newEmptyCart() {
        ShopCartDto dto = new ShopCartDto();
        dto.setCartId(null);
        dto.setItems(new ArrayList<>());
        dto.setTotal(0);
        return dto;
    }

    private CheckoutBuyerDto toBuyerDto(User user) {
        CheckoutBuyerDto b = new CheckoutBuyerDto();
        b.setUsername(user.getUsername());
        b.setEmail(user.getEmail());
        b.setFirstName(user.getFirstName());
        b.setLastName(user.getLastName());
        b.setPhone(user.getPhone());
        return b;
    }
}
