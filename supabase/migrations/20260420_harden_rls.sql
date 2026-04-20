-- Harden RLS policies to prevent unauthenticated access via public Anon Key

-- 1. Remove insecure public SELECT access
DROP POLICY IF EXISTS "Allow select for all" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_private_data;

-- 2. Remove insecure public/anonymous INSERT access
DROP POLICY IF EXISTS "Allow insert for anon" ON public.messages;

-- 3. Restrict Storage Bucket 'message-images' to authenticated users only
DROP POLICY IF EXISTS "Allow all 1nagy66_3" ON storage.objects;
DROP POLICY IF EXISTS "Allow all 1nagy66_2" ON storage.objects;
DROP POLICY IF EXISTS "Allow all 1nagy66_1" ON storage.objects;

CREATE POLICY "Allow authenticated insert to message-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'message-images' AND auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update to message-images" ON storage.objects FOR UPDATE USING (bucket_id = 'message-images' AND auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete to message-images" ON storage.objects FOR DELETE USING (bucket_id = 'message-images' AND auth.role() = 'authenticated');
