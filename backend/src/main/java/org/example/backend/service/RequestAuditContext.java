package org.example.backend.service;

public final class RequestAuditContext {

    private static final ThreadLocal<String> IP_ADDRESS = new ThreadLocal<>();
    private static final ThreadLocal<String> USER_AGENT = new ThreadLocal<>();

    private RequestAuditContext() {
    }

    public static void set(String ipAddress, String userAgent) {
        IP_ADDRESS.set(ipAddress);
        USER_AGENT.set(userAgent);
    }

    public static String ipAddress() {
        return IP_ADDRESS.get();
    }

    public static String userAgent() {
        return USER_AGENT.get();
    }

    public static void clear() {
        IP_ADDRESS.remove();
        USER_AGENT.remove();
    }
}
