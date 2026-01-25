
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://kcixshzfygfnubmhcbmp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaXhzaHpmeWdmbnVibWhjYm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNzUyNzgsImV4cCI6MjA3Nzk1MTI3OH0.3-UgKdqbtk4l2LYYhJUbKYHIt41VobWFujS1v11xeNc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRPC() {
    console.log("Testing get_admin_users_paginated RPC...");

    const { data, error } = await supabase.rpc('get_admin_users_paginated', {
        page_number: 1,
        page_size: 10,
        search_query: '',
        status_filter: 'all'
    });

    if (error) {
        console.error("RPC Error:", error);
        return;
    }

    console.log("Success! Found users:", data.length);
    if (data.length > 0) {
        console.log("First User Sample:");
        const u = data[0];
        console.log(`- Name: ${u.full_name}`);
        console.log(`- Documents Submitted: ${u.documents_submitted} (Type: ${typeof u.documents_submitted})`);
        console.log(`- Is Verified: ${u.is_verified}`);
        console.log(`- Sub End: ${u.subscription_end_date}`);

        // Check for Remdan specifically if possible (search logic)
        const remdan = data.find(d => d.full_name.toLowerCase().includes('remdan'));
        if (remdan) {
            console.log("\n--- REMDAN FOUND ---");
            console.log(remdan);
        } else {
            console.log("\nRemdan not found in first page.");
        }
    }
}

testRPC();
