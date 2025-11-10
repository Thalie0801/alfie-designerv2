import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Job, JobEvent } from '@/lib/types/alfie';

export function useJobs(orderId: string | null) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const knownJobIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!orderId) {
      setJobs([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    knownJobIds.current = new Set();

    const fetchData = async () => {
      const { data: jobRows, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (!isMounted) {
        return;
      }

      if (jobError) {
        console.error('[useJobs] failed to fetch jobs', jobError);
        setJobs([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const fetchedJobs = (jobRows ?? []) as Job[];
      setJobs(fetchedJobs);
      knownJobIds.current = new Set(fetchedJobs.map((job) => job.id));

      if (fetchedJobs.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const jobIds = fetchedJobs.map((job) => job.id);
      const { data: eventRows, error: eventError } = await supabase
        .from('job_events')
        .select('*')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      if (!isMounted) {
        return;
      }

      if (eventError) {
        console.error('[useJobs] failed to fetch job events', eventError);
        setEvents([]);
      } else {
        setEvents((eventRows ?? []) as JobEvent[]);
      }

      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as Job;
          knownJobIds.current.add(updated.id);
          setJobs((prev) => prev.map((job) => (job.id === updated.id ? updated : job)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const inserted = payload.new as Job;
          if (!knownJobIds.current.has(inserted.id)) {
            knownJobIds.current.add(inserted.id);
            setJobs((prev) => [...prev, inserted]);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_events' },
        (payload) => {
          const event = payload.new as JobEvent;
          if (knownJobIds.current.has(event.job_id)) {
            setEvents((prev) => [event, ...prev]);
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { jobs, events, loading };
}
