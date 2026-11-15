-- MySQL dump 10.13  Distrib 9.7.1, for macos14.8 (x86_64)
--
-- Host: 127.0.0.1    Database: jesi_cosmetic
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `addresses`
--

DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `label` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line1` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `state_province` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cambodia',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `addresses`
--

LOCK TABLES `addresses` WRITE;
/*!40000 ALTER TABLE `addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_product` (`session_id`,`product_id`),
  UNIQUE KEY `uniq_user_product` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `cart_items_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart_items`
--

LOCK TABLES `cart_items` WRITE;
/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'back_in_stock',
  `product_id` int DEFAULT NULL,
  `message` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `idx_order` (`order_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `address_id` int DEFAULT NULL,
  `status` enum('to_pay','to_receive','to_review','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'to_pay',
  `rating` tinyint DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `shipping_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  `placed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `address_id` (`address_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
INSERT INTO `password_reset_tokens` VALUES (1,2,'91f27c5f908ac4d51c2ed0c5e5d1a8f89e81b1cfc2c96a1f41bd06ef10b1d782','2026-11-08 17:25:59',NULL,'2026-11-08 09:55:58');
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product` (`product_id`),
  CONSTRAINT `product_images_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_images`
--

LOCK TABLES `product_images` WRITE;
/*!40000 ALTER TABLE `product_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Medicube',
  `price` decimal(10,2) NOT NULL,
  `old_price` decimal(10,2) DEFAULT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_class` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rating` decimal(2,1) DEFAULT NULL,
  `review_count` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `in_stock` tinyint(1) NOT NULL DEFAULT '1',
  `stock_quantity` int NOT NULL DEFAULT '50',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  FULLTEXT KEY `idx_name_search` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'Age R Booster Pro','devices','Medicube',128.00,NULL,'Booster.jpg','pi1',4.9,'1.2k','Best','A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',1,50,'2026-10-22 14:31:23'),(2,'Red Erasing Serum','serums','Medicube',18.00,NULL,'Red serum.jpg','pi2',4.8,'863',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(3,'Zero Pore One Day Cream','moisturizers','Medicube',17.00,NULL,'one day cream.jpg','pi3',4.7,'512','New','A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(4,'Kojic Acid Turmeric Gold Jelly Gel Mask','pads','Medicube',22.00,NULL,'yellow mask.jpg','pi4',4.9,'2.1k',NULL,'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(5,'PDRN Hydrating Gel Cleanser','cleansers','Medicube',15.00,NULL,'Red gel cleansing.jpg','pi5',4.6,'390',NULL,'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(6,'PDRN Pink One Day Serum','serums','Medicube',17.00,58.00,'Peptide.jpg','pi6',4.8,'748','Sale','A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(7,'Pore Tightening Serum','serums','Medicube',14.00,NULL,'collagen shot pink.jpg','pi1',4.8,'640',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(8,'Kojic Acid Turmeric Niacinamide Capsule Cream','moisturizers','Medicube',25.00,NULL,'Cream orange.jpg','pi4',4.8,'455',NULL,'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(9,'AGE-R ATS Air Shot','devices','Medicube',118.00,NULL,'Device 3.jpg','pi5',4.6,'148',NULL,'A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',1,50,'2026-10-22 14:31:23'),(10,'PDRN Pink Niacinamide Whip Cleanser','cleansers','Medicube',12.00,NULL,'Collagen cleansing.jpg','pi6',4.5,'207',NULL,'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(11,'Deep Vita C Daily Quick Mask (30 Sheets)','pads','Medicube',28.00,36.00,'Mask.jpg','pi1',4.7,'589','Sale','Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(12,'AGE-R Glutathione Glow Serum','serums','Medicube',18.00,NULL,'Age R serum.jpg','pi2',4.9,'674',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(13,'AGE-R Booster Pro Mini Plus & Cleansing Head Set','devices','Medicube',162.00,NULL,'Device Pink.jpg','pi3',4.4,'96',NULL,'A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',1,50,'2026-10-22 14:31:23'),(14,'Hyaluronic Moisturizing Capsule Cream','moisturizers','Medicube',27.00,NULL,'Cream blue.jpg','pi4',4.8,'233','New','A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(15,'Hyaluronic Multi Peptide Serum','serums','Medicube',16.00,NULL,'Blue serum.jpg','pi1',4.4,'1.6k',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(16,'Azelaic Acid Exosome Shot 2000','serums','Medicube',22.00,NULL,'Exo Serums.jpg','pi2',4.5,'1.5k',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(17,'Collagen Glow Booster Milk Serum','serums','Medicube',23.00,NULL,'Glow Serum.jpg','pi3',4.8,'1.2k',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(18,'PDRN Pink Collagen Glow Jelly Mist Serum','serums','Medicube',19.00,NULL,'Jelly Mist Serum.jpg','pi4',4.6,'101',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(19,'TXA Niacinamide 15 Serum','serums','Medicube',16.00,NULL,'Niacin serum.jpg','pi5',4.5,'1.3k',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(20,'One Day Exosome Shot 2000','serums','Medicube',22.00,59.00,'One day serum.jpg','pi6',4.4,'1.4k','Sale','A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(21,'PDRN Pink Peptide Serum','serums','Medicube',15.00,NULL,'PDRN serum.jpg','pi1',4.5,'1.2k',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(22,'Retinol NMN Boosting Serum 1.9%','serums','Medicube',21.00,NULL,'Retinol Serum.jpg','pi2',4.9,'1.6k',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(23,'Kojic Acid Turmeric Niacinamide Serum','serums','Medicube',18.00,NULL,'Yellow serum.jpg','pi3',4.6,'609',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(24,'Zero Pore One Day Serum','serums','Medicube',16.00,NULL,'Pore zero serum.jpg','pi4',5.0,'729',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23'),(25,'Red Cream 2.0','moisturizers','Medicube',16.00,NULL,'white cream.jpg','pi5',4.6,'775',NULL,'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(26,'TXA Niacinamide Capsule Cream','moisturizers','Medicube',19.00,NULL,'Cream red.jpg','pi6',4.9,'1.5k','New','A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(27,'Deep Vita C Capsule Cream','moisturizers','Medicube',22.00,NULL,'cream brown.jpg','pi1',5.0,'815',NULL,'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(28,'PDRN Pink Collagen Capsule Cream','moisturizers','Medicube',19.00,NULL,'cream pink.jpg','pi2',4.9,'1.3k',NULL,'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(29,'Triple Collagen Cream','moisturizers','Medicube',17.00,53.00,'Triple cream.jpg','pi3',4.8,'133','Sale','A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(30,'PDRN Pink Peptide Serum','moisturizers','Medicube',18.00,NULL,'peptide cream.jpg','pi4',5.0,'1.8k',NULL,'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(31,'Medicube 3H Daily Relief Cream','moisturizers','Medicube',14.00,57.00,'Calming cream.jpg','pi5',4.6,'968','Sale','A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(32,'AGE-R Booster Gel Serum','moisturizers','Medicube',24.00,NULL,'White Gel.jpg','pi6',4.4,'767',NULL,'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(33,'AGE-R Collagen Booster Gel Serum','moisturizers','Medicube',22.00,56.00,'Pink gel.jpg','pi1',4.8,'1.4k','Sale','A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',1,50,'2026-10-22 14:31:23'),(34,'Medicube AGE-R High Focus Shot','devices','Medicube',145.00,NULL,'device 2.jpg','pi2',4.7,'541',NULL,'A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',1,50,'2026-10-22 14:31:23'),(35,'AGE-R I Shot','devices','Medicube',148.00,201.00,'Device R.jpg','pi3',4.6,'1.4k','Sale','A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',1,50,'2026-10-22 14:31:23'),(36,'AGE-R Derma EMS Shot','devices','Medicube',125.00,NULL,'Device White.jpg','pi4',4.8,'1.8k',NULL,'A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',1,50,'2026-10-22 14:31:23'),(37,'Zero Pore SA Clear Capsule Cleansing Foam','cleansers','Medicube',16.00,NULL,'Blue cleanser.jpg','pi4',4.9,'857',NULL,'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(38,'Zero Foam Cleanser','cleansers','Medicube',14.00,NULL,'Foam Cleanser.jpg','pi5',5.0,'323','Best','A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(39,'PDRN Pink Glutathione Capsule Cleansing Foam','cleansers','Medicube',15.00,NULL,'Pink Cleanser.jpg','pi6',4.4,'136',NULL,'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(40,'Red Body Peeling Shot Cleanser','cleansers','Medicube',20.00,32.00,'Red cleanser.jpg','pi1',4.7,'1.7k','Sale','A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(41,'Red Foam Cleanser (120ml)','cleansers','Medicube',18.00,NULL,'white cleanser.jpg','pi2',4.3,'821','Best','A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(42,'Kojic Acid Turmeric Vita Capsule Cleansing Foam (120g)','cleansers','Medicube',18.00,NULL,'Yellow cleanser.jpg','pi3',4.7,'1.2k',NULL,'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(43,'Azelaic Acid Niacinamide Deep Clean Foam Cleanser (120g)','cleansers','Medicube',17.00,NULL,'Aze cleanser.jpg','pi4',4.8,'1.4k','Best','A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',1,50,'2026-10-22 14:31:23'),(44,'Collagen Night Wrapping Mask (75ml)','pads','Medicube',16.00,NULL,'wrap mask.jpg','pi5',4.8,'736',NULL,'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(45,'Kojic Acid Turmeric Night Wrapping Mask (75ml)','pads','Medicube',22.00,NULL,'yellow creamy mask.jpg','pi6',4.6,'969',NULL,'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(46,'Deep Vita C Pad (70 Pads)','pads','Medicube',23.00,NULL,'Deep vita pad.jpg','pi1',5.0,'1.6k',NULL,'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(47,'PDRN Pink Collagen Gel Mask (4 Sheets)','pads','Medicube',12.00,NULL,'Pink Collagen Masks.jpg','pi2',4.9,'1.3k',NULL,'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(48,'PDRN Pink Collagen Toning Gel Toner Pad (70 Pads)','pads','Medicube',23.00,NULL,'Pink pad.jpg','pi3',4.7,'353',NULL,'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(49,'Red Succinic Acid Peeling Pad (70 Pads)','pads','Medicube',22.00,NULL,'Red pad.jpg','pi4',4.7,'1.6k','Best','Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',1,50,'2026-10-22 14:31:23'),(50,'Triple Collagen Deep Glow Set','sets','Medicube',98.00,124.00,'Pink set.jpg','pi3',4.9,'420','Best','A curated Medicube bundle designed to work together for a complete routine — better value, better results.',1,50,'2026-10-22 14:31:23'),(51,'Zero Pore Perfecting Set','sets','Medicube',87.00,NULL,'Blue set.jpg','pi1',4.7,'266',NULL,'A curated Medicube bundle designed to work together for a complete routine — better value, better results.',1,50,'2026-10-22 14:31:23'),(52,'Red Line Starter Set','sets','Medicube',82.00,NULL,'White Full Set.jpg','pi5',4.8,'188','New','A curated Medicube bundle designed to work together for a complete routine — better value, better results.',1,50,'2026-10-22 14:31:23'),(53,'Rosemary PDRN Hair Care / Scalp Care Set','sets','Medicube',76.00,NULL,'Hair set.jpg','pi6',4.6,'134',NULL,'A curated Medicube bundle designed to work together for a complete routine — better value, better results.',1,50,'2026-10-22 14:31:23'),(54,'Red Succinic Acid Serum','serums','Medicube',12.00,NULL,'Red acid serum.jpg','pi6',4.2,'134',NULL,'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',1,50,'2026-10-22 14:31:23');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `review_media`
--

DROP TABLE IF EXISTS `review_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `review_id` int NOT NULL,
  `media_type` enum('image','video') COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_review` (`review_id`),
  CONSTRAINT `review_media_ibfk_1` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `review_media`
--

LOCK TABLES `review_media` WRITE;
/*!40000 ALTER TABLE `review_media` DISABLE KEYS */;
/*!40000 ALTER TABLE `review_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `order_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `order_id` (`order_id`),
  KEY `idx_product` (`product_id`),
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_ibfk_3` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_pin_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Jessy','Ressy@gmail.com','$2b$12$mN6rz2yW9RDdu1aDTm0pE.FMbqyEbyY.RrFDvkQ63uGja.eKoZnpW',NULL,'user','2026-10-22 13:42:04','2026-10-22 14:25:38'),(2,'Jessy','jessy@gmail.com','$2b$12$w5ypsXBBqkoJ87K8adfCBeVThjDK0DjTC/5v8LlGAcz6YOthpNoo2',NULL,'admin','2026-10-22 15:19:24','2026-11-08 10:59:59');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wishlist_items`
--

DROP TABLE IF EXISTS `wishlist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wishlist_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `product_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_product` (`session_id`,`product_id`),
  UNIQUE KEY `uniq_user_product_wl` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `fk_wishlist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wishlist_items_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wishlist_items`
--

LOCK TABLES `wishlist_items` WRITE;
/*!40000 ALTER TABLE `wishlist_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `wishlist_items` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-08 18:09:29
