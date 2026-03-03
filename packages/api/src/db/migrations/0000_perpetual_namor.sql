CREATE TYPE "public"."payment_method_type" AS ENUM('pix', 'ted');--> statement-breakpoint
CREATE TYPE "public"."pix_key_type" AS ENUM('cpf', 'cnpj', 'email', 'phone', 'random');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('pending', 'approved', 'contested', 'in_review', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."shift_modality" AS ENUM('presencial', 'online');--> statement-breakpoint
CREATE TYPE "public"."shift_period" AS ENUM('morning', 'afternoon', 'evening');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "appointment_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_appointment_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"month" varchar(7) NOT NULL,
	"is_paid" boolean,
	"is_excluded" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"details" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contestation_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"read_by_user_ids" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"method_type" "payment_method_type" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"pix_key_type" "pix_key_type",
	"pix_key" varchar(255),
	"holder_name" varchar(255),
	"holder_doc_type" varchar(10),
	"holder_document" varchar(20),
	"bank_code" varchar(10),
	"bank_name" varchar(255),
	"agency" varchar(20),
	"account_number" varchar(30),
	"account_type" varchar(20),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer DEFAULT 0 NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer NOT NULL,
	"month" varchar(7) NOT NULL,
	"status" "release_status" DEFAULT 'pending' NOT NULL,
	"released_by" integer NOT NULL,
	"responded_at" timestamp with time zone,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer NOT NULL,
	"month" varchar(7) NOT NULL,
	"data" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer NOT NULL,
	"month" varchar(7) NOT NULL,
	"day_of_week" integer NOT NULL,
	"period" "shift_period" NOT NULL,
	"modality" "shift_modality" NOT NULL,
	"shift_value" numeric(10, 2) NOT NULL,
	"origin" varchar(50) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"api_professional_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"reset_token" varchar(64),
	"reset_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contestation_messages" ADD CONSTRAINT "contestation_messages_release_id_report_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."report_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contestation_messages" ADD CONSTRAINT "contestation_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_releases" ADD CONSTRAINT "report_releases_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_override_appointment" ON "appointment_overrides" USING btree ("external_appointment_id","professional_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_config_professional_key" ON "professional_config" USING btree ("professional_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_release_professional_month" ON "report_releases" USING btree ("professional_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_snapshot_professional_month" ON "report_snapshots" USING btree ("professional_id","month");--> statement-breakpoint
CREATE INDEX "idx_shifts_professional_month" ON "shifts" USING btree ("professional_id","month");