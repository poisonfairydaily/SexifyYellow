CREATE OR REPLACE FUNCTION get_unread_message_count()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_group_count INTEGER := 0;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN 0;
    END IF;

    -- Count private messages
    SELECT COUNT(*) INTO v_count
    FROM public.messages
    WHERE receiver = v_uid AND is_read = false;

    -- Count group messages
    SELECT COUNT(m.id) INTO v_group_count
    FROM public.messages m
    JOIN public.chat_group_members cgm ON m.room_id = cgm.group_id::text
    WHERE cgm.user_id = v_uid
      AND m.sender_name != v_uid
      AND (cgm.last_read_time IS NULL OR m.created_at > cgm.last_read_time);

    RETURN v_count + v_group_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
