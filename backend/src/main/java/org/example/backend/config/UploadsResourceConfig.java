package org.example.backend.config;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class UploadsResourceConfig implements WebMvcConfigurer {

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		Path uploadsDir = Paths.get(System.getProperty("user.dir"), "uploads");
		// Serve uploaded media files so Angular can display them.
		registry.addResourceHandler("/uploads/**")
				.addResourceLocations("file:" + uploadsDir.toAbsolutePath().toString() + "/");
	}
}

