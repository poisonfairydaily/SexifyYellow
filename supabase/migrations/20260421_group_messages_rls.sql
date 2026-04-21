-- Allow users to view messages in chat groups they are members of
CREATE POLICY "Allow users to view group messages" ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_group_members cgm
        WHERE cgm.group_id::text = messages.room_id AND cgm.user_id = auth.uid()
    )
);
