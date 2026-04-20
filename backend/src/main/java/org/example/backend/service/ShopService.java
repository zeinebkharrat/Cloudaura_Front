package org.example.backend.service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.example.backend.dto.shop.AddToCartRequest;
import org.example.backend.dto.shop.CheckoutBuyerDto;
import org.example.backend.dto.shop.CheckoutOrderDto;
import org.example.backend.dto.shop.MyOrderSummaryDto;
import org.example.backend.dto.shop.OrderLineDto;
import org.example.backend.dto.shop.ShopCartDto;
import org.example.backend.dto.shop.ShopCartLineDto;
import org.example.backend.dto.shop.UpdateCartItemRequest;
import org.example.backend.model.Cart;
import org.example.backend.model.CartItem;
import org.example.backend.model.OrderEntity;
import org.example.backend.model.OrderItem;
import org.example.backend.model.OrderStatus;
import org.example.backend.model.Product;
import org.example.backend.model.User;
import org.example.backend.model.ProductVariant;
import org.example.backend.repository.CartItemRepository;
import org.example.backend.repository.CartRepository;
import org.example.backend.repository.OrderEntityRepository;
import org.example.backend.repository.OrderItemRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.ProductVariantRepository;
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
    private final ProductVariantRepository productVariantRepository;
    private final EmailService emailService;
    private final PaymentService paymentService;
    private final ShopReceiptPdfService shopReceiptPdfService;

    public ShopService(
        UserRepository userRepository,
        CartRepository cartRepository,
        CartItemRepository cartItemRepository,
        ProductRepository productRepository,
        OrderEntityRepository orderEntityRepository,
        OrderItemRepository orderItemRepository,
        ProductVariantRepository productVariantRepository,
        EmailService emailService,
        PaymentService paymentService,
        ShopReceiptPdfService shopReceiptPdfService
    ) {
        this.userRepository = userRepository;
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.productRepository = productRepository;
        this.orderEntityRepository = orderEntityRepository;
        this.orderItemRepository = orderItemRepository;
        this.productVariantRepository = productVariantRepository;
        this.emailService = emailService;
        this.paymentService = paymentService;
        this.shopReceiptPdfService = shopReceiptPdfService;
    }

    @Transactional(readOnly = true)
    public ShopCartDto getCart(String username) {
        if (username == null || username.isBlank()) {
            return newEmptyCart();
        }
        return userRepository.findFirstByUsernameIgnoreCaseOrderByUserIdAsc(username.trim())
            .flatMap(u -> cartRepository.findByUser_UserId(u.getUserId()))
            .map(this::toCartDto)
            .orElseGet(this::newEmptyCart);
    }

    private int getAvailableStock(Product product, ProductVariant variant, Integer excludeCartId) {
        int totalStock = (variant != null) ? (variant.getStock() != null ? variant.getStock() : 0)
                                           : (product.getStock() != null ? product.getStock() : 0);
        
        Integer reserved = (variant != null) 
            ? cartItemRepository.sumReservedQuantityForVariant(variant.getVariantId(), excludeCartId)
            : cartItemRepository.sumReservedQuantityForProduct(product.getProductId(), excludeCartId);
            
        return totalStock - (reserved != null ? reserved : 0);
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
        
        ProductVariant variant = null;
        if (request.getVariantId() != null) {
            variant = productVariantRepository.findById(request.getVariantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variante introuvable"));
            if (!variant.getProduct().getProductId().equals(product.getProductId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Variante non liée à ce produit");
            }
        }

        Cart cart = getOrCreateCart(user);
        int available = getAvailableStock(product, variant, cart.getCartId());
        
        if (available < qty) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuffisant (déjà réservé par d'autres)");
        }

        // Find existing item with same product AND same variant
        CartItem existing = cartItemRepository.findAll().stream()
            .filter(i -> i.getCart().getCartId().equals(cart.getCartId()))
            .filter(i -> i.getProduct().getProductId().equals(product.getProductId()))
            .filter(i -> (request.getVariantId() == null && i.getVariant() == null) || 
                         (request.getVariantId() != null && i.getVariant() != null && i.getVariant().getVariantId().equals(request.getVariantId())))
            .findFirst()
            .orElse(null);

        Date reservationEnd = new Date(System.currentTimeMillis() + 15 * 60 * 1000);

        if (existing != null) {
            int newQty = existing.getQuantity() + qty;
            if (newQty > available + existing.getQuantity()) {
                 // Technically covered by 'available' logic above but good to be safe
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuffisant pour ce panier");
            }
            existing.setQuantity(newQty);
            existing.setReservedUntil(reservationEnd);
            cartItemRepository.save(existing);
        } else {
            CartItem line = new CartItem();
            line.setCart(cart);
            line.setProduct(product);
            line.setVariant(variant);
            line.setQuantity(qty);
            line.setReservedUntil(reservationEnd);
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
        
        if (qty <= 0) {
            cartItemRepository.deleteById(cartItemId);
        } else {
            int available = getAvailableStock(line.getProduct(), line.getVariant(), cart.getCartId());
            if (qty > available + line.getQuantity()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuffisant");
            }
            line.setQuantity(qty);
            line.setReservedUntil(new Date(System.currentTimeMillis() + 15 * 60 * 1000));
            cartItemRepository.save(line);
        }
        return cartRepository.findByUser_UserId(user.getUserId())
            .map(this::toCartDto)
            .orElseGet(this::newEmptyCart);
    }

    @Transactional
    public CheckoutOrderDto checkout(String username, String paymentMethod) {
        User user = findUser(username);
        String pm = (paymentMethod != null && paymentMethod.equalsIgnoreCase("COD")) ? "COD" : "CARD";
        Cart cart = cartRepository.findByUser_UserId(user.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Panier vide"));
        List<CartItem> lines = cartItemRepository.findByCartIdWithProduct(cart.getCartId());
        if (lines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Panier vide");
        }

        double subtotal = 0;
        boolean allSameCity = true;
        String userCity = user.getCity() != null ? user.getCity().getName() : null;

        for (CartItem line : lines) {
            int qty = line.getQuantity();
            int available = getAvailableStock(line.getProduct(), line.getVariant(), cart.getCartId());
            if (available < 0) {
                 throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock plus disponible pour " + line.getProduct().getName());
            }

            // Delivery fee logic
            String artisanCity = (line.getProduct().getUser() != null && line.getProduct().getUser().getCity() != null) 
                                 ? line.getProduct().getUser().getCity().getName() : null;
            if (userCity == null || artisanCity == null || !userCity.equalsIgnoreCase(artisanCity)) {
                allSameCity = false;
            }

            double price = effectiveUnitPrice(line.getProduct(), line.getVariant());
            subtotal += price * qty;
        }

        // Remise automatique 5 % dès que le sous-total dépasse 200 TND (sans code promo)
        double discount = 0;
        if (subtotal > 200) {
            discount = subtotal * 0.05;
        }

        double deliveryFee = allSameCity ? 5.0 : 7.0;
        double total = (subtotal - discount) + deliveryFee;
        if (total < 0) total = deliveryFee; // Can't be negative but just in case

        OrderEntity order = new OrderEntity();
        order.setUser(user);
        order.setTotalAmount(total);
        order.setDeliveryFee(deliveryFee);
        order.setPaymentMethod(pm);
        order.setStatus(OrderStatus.PENDING);
        order.setCreatedAt(new Date());
        order = orderEntityRepository.save(order);

        List<OrderLineDto> outLines = new ArrayList<>();
        for (CartItem line : lines) {
            Product p = line.getProduct();
            ProductVariant v = line.getVariant();
            int qty = line.getQuantity();
            double price = effectiveUnitPrice(p, v);

            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setProduct(p);
            oi.setVariant(v);
            oi.setQuantity(qty);
            oi.setStatus(OrderStatus.PENDING);
            oi = orderItemRepository.save(oi);

            if (v != null) {
                v.setStock(Math.max(0, (v.getStock() != null ? v.getStock() : 0) - qty));
                productVariantRepository.save(v);
                
                // Update overall product stock sum
                int totalProductStock = productVariantRepository.findByProduct_ProductId(p.getProductId()).stream()
                    .mapToInt(var -> var.getStock() != null ? var.getStock() : 0)
                    .sum();
                p.setStock(totalProductStock);
                productRepository.save(p);
            } else {
                int newStock = Math.max(0, (p.getStock() != null ? p.getStock() : 0) - qty);
                p.setStock(newStock);
                productRepository.save(p);
            }

            OrderLineDto lineDto = new OrderLineDto(
                oi.getOrderItemId(),
                p.getProductId(),
                p.getName(),
                qty,
                price,
                price * qty
            );
            lineDto.setStatus(oi.getStatus() != null ? oi.getStatus().name() : null);
            lineDto.setVariantId(v != null ? v.getVariantId() : null);
            lineDto.setSize(v != null ? v.getSize() : null);
            lineDto.setColor(v != null ? v.getColor() : null);
            outLines.add(lineDto);
        }

        cartItemRepository.deleteAll(lines);

        CheckoutOrderDto dto = new CheckoutOrderDto();
        dto.setOrderId(order.getOrderId());
        dto.setStatus(order.getStatus());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setLines(outLines);
        dto.setOrderedAt(formatOrderInstant(order.getCreatedAt()));
        dto.setBuyer(toBuyerDto(user));
        dto.setPaymentMethod(pm);
        dto.setNewPromoCode(null);
        // Email recap only
        try {
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                emailService.sendOrderConfirmation(user.getEmail(), order.getOrderId().toString(), order.getTotalAmount());
            }
        } catch (Exception ex) {
            // Log error but don't block checkout
            System.err.println("Failed to send checkout email: " + ex.getMessage());
        }

        if ("CARD".equals(pm)) {
            dto.setPaymentUrl(paymentService.generatePaymentUrl(order));
        } else {
            dto.setPaymentUrl(null);
        }
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
        boolean isAdmin = u.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
            
        // Check if buyer
        boolean isBuyer = order.getUser() != null && order.getUser().getUserId().equals(u.getUserId());
        
        // Check if artisan of any product in this order
        List<OrderItem> items = orderItemRepository.findByOrderIdWithProduct(orderId);
        boolean isArtisanOfOrder = items.stream()
            .anyMatch(oi -> oi.getProduct() != null && oi.getProduct().getUser() != null && 
                            oi.getProduct().getUser().getUserId().equals(u.getUserId()));

        if (!isBuyer && !isArtisanOfOrder && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refuse");
        }
        
        User buyer = order.getUser();
        List<OrderLineDto> lines = new ArrayList<>();
        for (OrderItem oi : items) {
            if (!isBuyer && !isAdmin) {
                Integer artisanId = (oi.getProduct() != null && oi.getProduct().getUser() != null)
                    ? oi.getProduct().getUser().getUserId()
                    : null;
                if (artisanId == null || !artisanId.equals(u.getUserId())) {
                    continue;
                }
            }
            Product p = oi.getProduct();
            ProductVariant v = oi.getVariant();
            int qty = oi.getQuantity() != null ? oi.getQuantity() : 0;
            double price = effectiveUnitPrice(p, v);
            
            OrderLineDto ldto = new OrderLineDto(
                oi.getOrderItemId(),
                p.getProductId(),
                p.getName(),
                qty,
                price,
                price * qty
            );
            ldto.setStatus(oi.getStatus() != null ? oi.getStatus().name() : null);
            ldto.setVariantId(v != null ? v.getVariantId() : null);
            ldto.setSize(v != null ? v.getSize() : null);
            ldto.setColor(v != null ? v.getColor() : null);
            lines.add(ldto);
        }
        CheckoutOrderDto dto = new CheckoutOrderDto();
        dto.setOrderId(order.getOrderId());
        dto.setStatus(order.getStatus());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setLines(lines);
        dto.setOrderedAt(formatOrderInstant(order.getCreatedAt()));
        dto.setBuyer(toBuyerDto(buyer));
        dto.setPaymentMethod(order.getPaymentMethod());
        return dto;
    }

    @Transactional(readOnly = true)
    public byte[] generateMyOrderReceiptPdf(String username, Integer orderId) {
        CheckoutOrderDto dto = getMyOrderDetail(username, orderId);
        return shopReceiptPdfService.generateReceiptPdf(dto);
    }

    @Transactional
    public void updateOrderItemStatus(Integer orderItemId, OrderStatus newStatus, String artisanUsername) {
        if (newStatus == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut requis");
        }
        User actor = findUser(artisanUsername);
        boolean isAdmin = actor.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
        OrderItem item = orderItemRepository.findById(orderItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ligne de commande introuvable"));
        
        if (!isAdmin && (item.getProduct() == null || item.getProduct().getUser() == null || 
            !item.getProduct().getUser().getUserId().equals(actor.getUserId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Non autorisé à modifier cet article");
        }
        
        if (newStatus == OrderStatus.SHIPPED || newStatus == OrderStatus.DELIVERED) {
            try {
                User buyer = item.getOrder().getUser();
                if (buyer != null && buyer.getEmail() != null) {
                    emailService.sendDeliveryUpdate(buyer.getEmail(), item.getProduct().getName(), newStatus.name());
                }
            } catch (Exception ex) {
                System.err.println("Failed to send delivery update email: " + ex.getMessage());
            }
        }
        
        item.setStatus(newStatus);
        orderItemRepository.save(item);

        // Optional: Update main order status if all items are delivered?
        // For now, per-item is enough.
         if (item.getOrder() != null && item.getOrder().getOrderId() != null) {
            reconcileOrderHeaderStatus(item.getOrder().getOrderId());
        }
    }
 /**
     * Keeps {@code orders.status} aligned with line items so DB/UI stay consistent
     * (artisans often check the parent {@code orders} row).
     */
    private void reconcileOrderHeaderStatus(Integer orderId) {
        OrderEntity order = orderEntityRepository.findById(orderId).orElse(null);
        if (order == null) {
            return;
        }
        List<OrderItem> lines = orderItemRepository.findByOrderIdWithProduct(orderId);
        if (lines.isEmpty()) {
            return;
        }
        List<OrderItem> active = lines.stream()
            .filter(i -> i.getStatus() != OrderStatus.CANCELLED)
            .toList();
        if (active.isEmpty()) {
            order.setStatus(OrderStatus.CANCELLED);
            orderEntityRepository.save(order);
            return;
        }

         boolean allDelivered = active.stream().allMatch(i -> i.getStatus() == OrderStatus.DELIVERED);
        if (allDelivered) {
            order.setStatus(OrderStatus.DELIVERED);
            orderEntityRepository.save(order);
            return;
        }
        boolean anyShippedOrDelivered = active.stream()
            .anyMatch(i -> i.getStatus() == OrderStatus.SHIPPED || i.getStatus() == OrderStatus.DELIVERED);
        if (anyShippedOrDelivered) {
            order.setStatus(OrderStatus.SHIPPED);
            orderEntityRepository.save(order);
            return;
        }
        boolean anyProcessing = active.stream().anyMatch(i -> i.getStatus() == OrderStatus.PROCESSING);
        if (anyProcessing) {
            order.setStatus(OrderStatus.PROCESSING);
            orderEntityRepository.save(order);
            return;
        }
        boolean allPending = active.stream().allMatch(i -> i.getStatus() == OrderStatus.PENDING);
        if (allPending) {
            order.setStatus(OrderStatus.PENDING);
            orderEntityRepository.save(order);
        }
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
        return userRepository.findFirstByUsernameIgnoreCaseOrderByUserIdAsc(identifier)
            .or(() -> userRepository.findFirstByEmailIgnoreCaseOrderByUserIdAsc(identifier))
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

    /**
     * Prix unitaire : override variante uniquement s'il est strictement &gt; 0, sinon prix produit.
     * Les variantes textile avec override à 0 utilisent le prix catalogue.
     */
    private static double effectiveUnitPrice(Product p, ProductVariant v) {
        if (p == null) {
            return 0;
        }
        if (v != null) {
            Double po = v.getPriceOverride();
            if (po != null && po > 0) {
                return po;
            }
        }
        return p.getPrice() != null ? p.getPrice() : 0;
    }

    private ShopCartDto toCartDto(Cart cart) {
        List<CartItem> lines = cartItemRepository.findByCartIdWithProduct(cart.getCartId());
        ShopCartDto dto = new ShopCartDto();
        dto.setCartId(cart.getCartId());
        double total = 0;
        List<ShopCartLineDto> items = new ArrayList<>();
        for (CartItem line : lines) {
            Product p = line.getProduct();
            ProductVariant v = line.getVariant();
            int qty = line.getQuantity();
            double price = effectiveUnitPrice(p, v);
            double lineTotal = price * qty;
            total += lineTotal;
            
            ShopCartLineDto ldto = new ShopCartLineDto(
                line.getCartItemId(),
                p.getProductId(),
                p.getName(),
                p.getImageUrl(),
                price,
                qty,
                lineTotal,
                (v != null ? v.getStock() : p.getStock())
            );
            ldto.setVariantId(v != null ? v.getVariantId() : null);
            ldto.setSize(v != null ? v.getSize() : null);
            ldto.setColor(v != null ? v.getColor() : null);
            items.add(ldto);
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
