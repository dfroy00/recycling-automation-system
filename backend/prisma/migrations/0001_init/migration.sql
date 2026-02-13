-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "sites" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "site_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL,
    "trip_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "trip_fee_type" TEXT,
    "trip_fee_amount" DECIMAL(10,2),
    "statement_type" TEXT NOT NULL DEFAULT 'monthly',
    "payment_type" TEXT NOT NULL DEFAULT 'lump_sum',
    "statement_send_day" INTEGER DEFAULT 15,
    "payment_due_day" INTEGER DEFAULT 15,
    "invoice_required" BOOLEAN NOT NULL DEFAULT false,
    "invoice_type" TEXT DEFAULT 'net',
    "notification_method" TEXT NOT NULL DEFAULT 'email',
    "notification_email" TEXT,
    "notification_line_id" TEXT,
    "payment_account" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_fees" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "billing_direction" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "contract_number" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_items" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "billing_direction" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,
    "trip_date" DATE NOT NULL,
    "trip_time" TEXT,
    "driver" TEXT,
    "vehicle_plate" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "external_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_items" (
    "id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "billing_direction" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "statement_type" TEXT NOT NULL,
    "trip_id" INTEGER,
    "year_month" TEXT NOT NULL,
    "item_receivable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "item_payable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trip_fee_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additional_fee_receivable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additional_fee_payable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_receivable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_payable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivable_subtotal" DECIMAL(12,2),
    "receivable_tax" DECIMAL(12,2),
    "receivable_total" DECIMAL(12,2),
    "payable_subtotal" DECIMAL(12,2),
    "payable_tax" DECIMAL(12,2),
    "payable_total" DECIMAL(12,2),
    "detail_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_method" TEXT,
    "send_retry_count" INTEGER NOT NULL DEFAULT 0,
    "send_error" TEXT,
    "voided_at" TIMESTAMP(3),
    "voided_by" INTEGER,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_content" TEXT NOT NULL,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_pos_collections" (
    "id" SERIAL NOT NULL,
    "external_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "collection_date" DATE NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_pos_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_vehicle_trips" (
    "id" SERIAL NOT NULL,
    "external_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "trip_date" DATE NOT NULL,
    "trip_time" TEXT,
    "driver" TEXT NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_vehicle_trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_name_key" ON "items"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_number_key" ON "contracts"("contract_number");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "mock_pos_collections_external_id_key" ON "mock_pos_collections"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_vehicle_trips_external_id_key" ON "mock_vehicle_trips"("external_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_fees" ADD CONSTRAINT "customer_fees_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
