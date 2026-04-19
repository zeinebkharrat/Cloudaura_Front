package org.example.backend.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;
import org.example.backend.dto.shop.CheckoutOrderDto;
import org.example.backend.dto.shop.OrderLineDto;
import org.springframework.stereotype.Service;

@Service
public class ShopReceiptPdfService {

    private static final DateTimeFormatter GENERATED_AT = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", Locale.ENGLISH);

    public byte[] generateReceiptPdf(CheckoutOrderDto order) {
        String html = buildHtml(order);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to generate shop receipt PDF", e);
        }
    }

    private String buildHtml(CheckoutOrderDto order) {
        StringBuilder rows = new StringBuilder();
        if (order.getLines() != null) {
            for (OrderLineDto line : order.getLines()) {
                StringBuilder item = new StringBuilder(esc(line.getName()));
                if (line.getSize() != null && !line.getSize().isBlank()) {
                    item.append("<br/><span style='color:#666;font-size:11px'>Size: ").append(esc(line.getSize())).append("</span>");
                }
                if (line.getColor() != null && !line.getColor().isBlank()) {
                    item.append("<br/><span style='color:#666;font-size:11px'>Color: ").append(esc(line.getColor())).append("</span>");
                }
                if (line.getStatus() != null && !line.getStatus().isBlank()) {
                    item.append("<br/><span style='color:#666;font-size:11px'>Line status: ").append(esc(line.getStatus())).append("</span>");
                }
                rows.append("<tr>")
                    .append("<td>").append(item).append("</td>")
                    .append("<td class='num'>").append(line.getQuantity() == null ? "0" : line.getQuantity()).append("</td>")
                    .append("<td class='num'>").append(formatMoney(line.getUnitPrice())).append("</td>")
                    .append("<td class='num'>").append(formatMoney(line.getLineTotal())).append("</td>")
                    .append("</tr>");
            }
        }
        return """
            <html>
            <head>
              <meta charset="utf-8"/>
              <style>
                body{font-family:Arial,sans-serif;color:#111;padding:24px}
                .top{display:flex;align-items:center;gap:12px;border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:16px}
                .logo{height:40px}
                .title{font-size:20px;font-weight:700;margin:0}
                .sub{font-size:12px;color:#666;margin:2px 0 0}
                .meta{margin:14px 0}
                .meta p{margin:4px 0}
                table{width:100%;border-collapse:collapse;margin-top:10px}
                th,td{border-bottom:1px solid #e6e6e6;padding:8px;font-size:12px}
                th{text-align:left;color:#555}
                .num{text-align:right}
                .total{margin-top:14px;font-weight:700;text-align:right}
                .muted{color:#666;font-size:11px;margin-top:18px}
              </style>
            </head>
            <body>
              <div class="top">
                __LOGO_HTML__
                <div>
                  <p class="title">YallaTN+ Receipt</p>
                  <p class="sub">Order confirmation</p>
                </div>
              </div>
              <div class="meta">
                <p><strong>Order:</strong> #__ORDER_ID__</p>
                <p><strong>Status:</strong> __STATUS__</p>
                <p><strong>Payment method:</strong> __PAYMENT_METHOD__</p>
                <p><strong>Ordered at:</strong> __ORDERED_AT__</p>
              </div>
              <div class="meta">
                <p><strong>Buyer:</strong> __BUYER_NAME__</p>
                <p><strong>Email:</strong> __BUYER_EMAIL__</p>
                <p><strong>Phone:</strong> __BUYER_PHONE__</p>
                <p><strong>Username:</strong> __BUYER_USERNAME__</p>
              </div>
              <table>
                <thead>
                  <tr><th>Item</th><th class='num'>Qty</th><th class='num'>Unit</th><th class='num'>Subtotal</th></tr>
                </thead>
                <tbody>
                  __LINES__
                </tbody>
              </table>
              <p class="total">Total: __TOTAL__</p>
              <p class="muted">Generated at __GENERATED_AT__</p>
            </body>
            </html>
            """
            .replace("__LOGO_HTML__", buildLogoHtml())
            .replace("__ORDER_ID__", String.valueOf(order.getOrderId()))
            .replace("__STATUS__", esc(order.getStatus() != null ? order.getStatus().name() : "PENDING"))
            .replace("__PAYMENT_METHOD__", esc(paymentMethodLabel(order.getPaymentMethod())))
            .replace("__ORDERED_AT__", esc(order.getOrderedAt() != null ? order.getOrderedAt() : "—"))
            .replace("__BUYER_NAME__", esc(buyerName(order)))
            .replace("__BUYER_EMAIL__", esc(order.getBuyer() != null && order.getBuyer().getEmail() != null ? order.getBuyer().getEmail() : "—"))
            .replace("__BUYER_PHONE__", esc(order.getBuyer() != null && order.getBuyer().getPhone() != null ? order.getBuyer().getPhone() : "—"))
            .replace("__BUYER_USERNAME__", esc(order.getBuyer() != null && order.getBuyer().getUsername() != null ? order.getBuyer().getUsername() : "—"))
            .replace("__LINES__", rows.toString())
            .replace("__TOTAL__", esc(formatMoney(order.getTotalAmount())))
            .replace("__GENERATED_AT__", esc(LocalDateTime.now().format(GENERATED_AT)));
    }

    private static String buyerName(CheckoutOrderDto order) {
        if (order.getBuyer() == null) return "—";
        String first = order.getBuyer().getFirstName() != null ? order.getBuyer().getFirstName().trim() : "";
        String last = order.getBuyer().getLastName() != null ? order.getBuyer().getLastName().trim() : "";
        String full = (first + " " + last).trim();
        if (!full.isBlank()) return full;
        return order.getBuyer().getUsername() != null ? order.getBuyer().getUsername() : "—";
    }

    private static String paymentMethodLabel(String method) {
        if (method == null) return "—";
        String m = method.trim().toUpperCase(Locale.ROOT);
        if ("CARD".equals(m)) return "Card payment";
        if ("COD".equals(m)) return "Cash on delivery";
        return method;
    }

    private static String formatMoney(Double n) {
        double value = n != null ? n : 0.0;
        return String.format(Locale.ENGLISH, "%.2f TND", value);
    }

    private String buildLogoHtml() {
        try (InputStream in = TicketPdfService.class.getResourceAsStream("/branding/yallatn-logo.png")) {
            if (in == null) {
                return "<div>YallaTN+</div>";
            }
            byte[] bytes = in.readAllBytes();
            if (bytes.length == 0) {
                return "<div>YallaTN+</div>";
            }
            return "<img class='logo' src='data:image/png;base64," + Base64.getEncoder().encodeToString(bytes) + "' alt='YallaTN+'/>";
        } catch (IOException ex) {
            return "<div>YallaTN+</div>";
        }
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;");
    }
}
