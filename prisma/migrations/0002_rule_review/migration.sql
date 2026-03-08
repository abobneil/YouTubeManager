ALTER TABLE "public"."videos"
ADD COLUMN "thumbnail_url" TEXT;

ALTER TABLE "public"."playlist_memberships"
ADD COLUMN "removed_at" TIMESTAMP(3),
ADD COLUMN "removal_reason" TEXT;

CREATE TABLE "public"."rule_video_exclusions" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_video_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rule_video_exclusions_rule_id_video_id_key" ON "public"."rule_video_exclusions"("rule_id", "video_id");

ALTER TABLE "public"."rule_video_exclusions"
ADD CONSTRAINT "rule_video_exclusions_rule_id_fkey"
FOREIGN KEY ("rule_id") REFERENCES "public"."topic_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."rule_video_exclusions"
ADD CONSTRAINT "rule_video_exclusions_video_id_fkey"
FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
