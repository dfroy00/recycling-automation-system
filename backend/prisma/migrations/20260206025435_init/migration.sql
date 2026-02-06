-- CreateTable
CREATE TABLE "sites" (
    "site_id" VARCHAR(20) NOT NULL,
    "site_name" VARCHAR(100) NOT NULL,
    "manager" VARCHAR(50),
    "contact_phone" VARCHAR(20),
    "contact_email" VARCHAR(100),
    "status" VARCHAR(10) NOT NULL DEFAULT '啟用',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("site_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" VARCHAR(20) NOT NULL,
    "site_id" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(100) NOT NULL,
    "billing_type" CHAR(1) NOT NULL,
    "trip_price" DECIMAL(10,2),
    "notification_method" VARCHAR(10) NOT NULL DEFAULT 'Email',
    "line_id" VARCHAR(100),
    "email" VARCHAR(100),
    "status" VARCHAR(10) NOT NULL DEFAULT '啟用',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "contract_prices" (
    "contract_price_id" SERIAL NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "contract_price" DECIMAL(10,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_prices_pkey" PRIMARY KEY ("contract_price_id")
);

-- CreateTable
CREATE TABLE "item_prices" (
    "item_price_id" SERIAL NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "standard_price" DECIMAL(10,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_prices_pkey" PRIMARY KEY ("item_price_id")
);

-- CreateTable
CREATE TABLE "trips" (
    "trip_id" SERIAL NOT NULL,
    "site_id" VARCHAR(20) NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "trip_date" DATE NOT NULL,
    "trip_time" TIME NOT NULL,
    "driver" VARCHAR(50) NOT NULL,
    "vehicle_plate" VARCHAR(20) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_file" VARCHAR(200),

    CONSTRAINT "trips_pkey" PRIMARY KEY ("trip_id")
);

-- CreateTable
CREATE TABLE "items_collected" (
    "collection_id" SERIAL NOT NULL,
    "site_id" VARCHAR(20) NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "collection_date" DATE NOT NULL,
    "item_name" VARCHAR(100) NOT NULL,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_file" VARCHAR(200),

    CONSTRAINT "items_collected_pkey" PRIMARY KEY ("collection_id")
);

-- CreateTable
CREATE TABLE "monthly_statements" (
    "statement_id" SERIAL NOT NULL,
    "site_id" VARCHAR(20) NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "detail_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "send_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "pdf_path" VARCHAR(200),

    CONSTRAINT "monthly_statements_pkey" PRIMARY KEY ("statement_id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "log_id" SERIAL NOT NULL,
    "site_id" VARCHAR(20),
    "event_type" VARCHAR(50) NOT NULL,
    "event_content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(200) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "site_id" VARCHAR(20),
    "email" VARCHAR(100),
    "status" VARCHAR(10) NOT NULL DEFAULT '啟用',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "idx_customer_site_id" ON "customers"("site_id");

-- CreateIndex
CREATE INDEX "idx_customer_billing_type" ON "customers"("billing_type");

-- CreateIndex
CREATE INDEX "idx_contract_customer_item" ON "contract_prices"("customer_id", "item_name");

-- CreateIndex
CREATE INDEX "idx_contract_end_date" ON "contract_prices"("end_date");

-- CreateIndex
CREATE INDEX "idx_item_effective" ON "item_prices"("item_name", "effective_date", "expiry_date");

-- CreateIndex
CREATE INDEX "idx_trip_customer_date" ON "trips"("customer_id", "trip_date");

-- CreateIndex
CREATE INDEX "idx_trip_site_date" ON "trips"("site_id", "trip_date");

-- CreateIndex
CREATE INDEX "idx_collected_customer_date" ON "items_collected"("customer_id", "collection_date");

-- CreateIndex
CREATE INDEX "idx_collected_item_date" ON "items_collected"("item_name", "collection_date");

-- CreateIndex
CREATE INDEX "idx_statement_year_month" ON "monthly_statements"("year_month");

-- CreateIndex
CREATE INDEX "idx_statement_send_status" ON "monthly_statements"("send_status");

-- CreateIndex
CREATE INDEX "idx_log_event_time" ON "system_logs"("event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_user_role" ON "users"("role");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_collected" ADD CONSTRAINT "items_collected_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_collected" ADD CONSTRAINT "items_collected_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_statements" ADD CONSTRAINT "monthly_statements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_statements" ADD CONSTRAINT "monthly_statements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("site_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("site_id") ON DELETE SET NULL ON UPDATE CASCADE;
