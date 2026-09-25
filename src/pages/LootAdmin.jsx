import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { getCurrentUser } from "@/api/userApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Lock, Gift, Wand2, ArrowLeft } from "lucide-react";

const formatChance = (weight, totalWeight) => {
  const numericWeight = Number(weight || 0);
  const numericTotal = Number(totalWeight || 0);
  if (!Number.isFinite(numericWeight) || !Number.isFinite(numericTotal) || numericTotal <= 0) return "—";
  const pct = (numericWeight / numericTotal) * 100;
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(2)}%`;
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const isSameLootboxEntry = (left, right) => {
  const hasMatchingReward = Boolean(left?.reward_id) && left.reward_id === right?.reward_id;
  const hasMatchingCurrency = Boolean(left?.sync_key) && left.sync_key === right?.sync_key;
  return hasMatchingReward || hasMatchingCurrency;
};

export default function LootAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ["lootAdminUser"],
    queryFn: async () => {
      const user = await getCurrentUser();
      return user;
    },
    retry: false,
    staleTime: 60_000,
  });

  const isAdmin = Boolean(currentUser?.role === "admin");

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ["lootAdminRewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Rewards")
        .select("id, name, display_name, type, value, image_url, custom_description")
        .order("display_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ["lootAdminPools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ZoneLootboxPool")
        .select(`
          id,
          zone_theme,
          name,
          description,
          is_active,
          created_at,
          entries:ZoneLootboxEntry(
            id,
            pool_id,
            reward_id,
            weight,
            duplicate_seed_value,
            selection_group,
            shared_only,
            currency_code,
            currency_amount,
            sync_key,
            reward:Rewards(id, name, display_name, type, value, image_url)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const [poolDrafts, setPoolDrafts] = useState({});
  const [entryDrafts, setEntryDrafts] = useState({});
  const [newEntryDrafts, setNewEntryDrafts] = useState({});
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [selectedSelectionGroup, setSelectedSelectionGroup] = useState("bonus");

  const poolSummaries = useMemo(() => pools.map((pool) => {
    const entries = Array.isArray(pool.entries) ? pool.entries : [];
    const totalWeight = entries.reduce((sum, entry) => sum + toNumber(entry?.weight ?? 0, 0), 0);
    return {
      ...pool,
      totalWeight,
      entries,
    };
  }), [pools]);

  const selectedPool = poolSummaries.find((pool) => pool.id === selectedPoolId) || poolSummaries[0] || null;

  const updatePoolMutation = useMutation({
    mutationFn: async ({ id, values }) => {
      const { data, error } = await supabase
        .from("ZoneLootboxPool")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lootAdminPools"] });
    },
  });

  const savePool = (pool) => {
    const draft = poolDrafts[pool.id] || {
      name: pool.name || "",
      description: pool.description || "",
      is_active: Boolean(pool.is_active),
    };

    updatePoolMutation.mutate({
      id: pool.id,
      values: {
        name: draft.name.trim() || pool.name || "",
        description: draft.description || "",
        is_active: Boolean(draft.is_active),
      },
    });
  };

  const saveEntryMutation = useMutation({
    mutationFn: async ({ entry, values }) => {
      const matchingEntryIds = pools
        .flatMap((pool) => pool.entries || [])
        .filter((candidate) => isSameLootboxEntry(entry, candidate))
        .map((candidate) => candidate.id);

      const { data, error } = await supabase
        .from("ZoneLootboxEntry")
        .update(values)
        .in("id", matchingEntryIds)
        .select()
        ;
      if (error) throw error;
      return data || [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lootAdminPools"] });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId) => {
      const { error } = await supabase
        .from("ZoneLootboxEntry")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lootAdminPools"] });
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async ({ poolId, values }) => {
      const payload = {
        pool_id: poolId,
        reward_id: values.reward_id,
        selection_group: values.selection_group,
        weight: toNumber(values.weight, 1),
        duplicate_seed_value: toNumber(values.duplicate_seed_value, 0),
        shared_only: Boolean(values.shared_only),
      };

      const { data, error } = await supabase
        .from("ZoneLootboxEntry")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lootAdminPools"] });
    },
  });

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Lade Admin-Daten...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <Card className="w-full max-w-lg border-red-500/20 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <Lock className="h-5 w-5" /> Zugriff verweigert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              Diese Seite ist nur für Admins verfügbar.
            </p>
            <Button onClick={() => navigate("/")}>Zur Startseite</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPoolCard = (pool) => {
    const draft = poolDrafts[pool.id] || {
      name: pool.name || "",
      description: pool.description || "",
      is_active: Boolean(pool.is_active),
    };

    const newEntryDraft = newEntryDrafts[pool.id] || {
      reward_id: "",
      weight: 10,
      duplicate_seed_value: 0,
      shared_only: false,
    };
    const visibleEntries = pool.entries.filter(
      (entry) => (entry.selection_group || "bonus") === selectedSelectionGroup
    );
    const visibleTotalWeight = visibleEntries.reduce(
      (sum, entry) => sum + toNumber(entry.weight, 0),
      0
    );

    return (
      <Card key={pool.id} className="border-emerald-500/20 bg-slate-900/80 text-slate-100 shadow-xl">
        <CardHeader className="border-b border-slate-700/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">{pool.zone_theme || "all"}</p>
              <CardTitle className="mt-1 text-2xl text-white">{pool.name || "Unbenannte Knospe"}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={pool.is_active ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-300"}>
                {pool.is_active ? "Aktiv" : "Inaktiv"}
              </Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-200">
                Gesamtgewicht: {visibleTotalWeight}
              </Badge>
            </div>
          </div>
          <div className="mt-5 flex w-full rounded-lg border border-slate-700 bg-slate-950/70 p-1 lg:w-fit">
            {["guaranteed", "bonus"].map((selectionGroup) => (
              <button
                key={selectionGroup}
                type="button"
                onClick={() => setSelectedSelectionGroup(selectionGroup)}
                className={`min-w-32 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  selectedSelectionGroup === selectionGroup
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {selectionGroup === "guaranteed" ? "Guaranteed" : "Bonus"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`name-${pool.id}`}>Pool-Name</Label>
              <Input
                id={`name-${pool.id}`}
                value={draft.name}
                onChange={(event) => setPoolDrafts((previous) => ({
                  ...previous,
                  [pool.id]: { ...draft, name: event.target.value },
                }))}
                placeholder="Wald-Knospe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`active-${pool.id}`}>Status</Label>
              <Select
                value={String(Boolean(draft.is_active))}
                onValueChange={(value) => setPoolDrafts((previous) => ({
                  ...previous,
                  [pool.id]: { ...draft, is_active: value === "true" },
                }))}
              >
                <SelectTrigger id={`active-${pool.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktiv</SelectItem>
                  <SelectItem value="false">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`description-${pool.id}`}>Beschreibung</Label>
            <Textarea
              id={`description-${pool.id}`}
              value={draft.description}
              rows={3}
              onChange={(event) => setPoolDrafts((previous) => ({
                ...previous,
                [pool.id]: { ...draft, description: event.target.value },
              }))}
              placeholder="Beschreibung der Knospe für Spieler:innen"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => savePool(pool)} disabled={updatePoolMutation.isPending}>
              {updatePoolMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Pool speichern
            </Button>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">Einträge</h3>
              <Badge variant="outline" className="border-slate-600 text-slate-200">
                {visibleEntries.length} {selectedSelectionGroup}-Einträge
              </Badge>
            </div>

            {visibleEntries.length === 0 ? (
              <p className="text-sm text-slate-400">Noch keine {selectedSelectionGroup}-Einträge. Füge eine Belohnung hinzu.</p>
            ) : (
              <div className="space-y-3">
                {visibleEntries.map((entry) => {
                  const reward = entry.reward || null;
                  const matchingEntryCount = poolSummaries
                    .flatMap((candidatePool) => candidatePool.entries)
                    .filter((candidate) => isSameLootboxEntry(entry, candidate)).length;
                  const thisDraft = entryDrafts[entry.id] || {
                    weight: entry.weight ?? 1,
                    duplicate_seed_value: entry.duplicate_seed_value ?? 0,
                    shared_only: Boolean(entry.shared_only),
                    selection_group: entry.selection_group || "bonus",
                    currency_amount: entry.currency_amount ?? 1,
                  };

                  return (
                    <div key={entry.id} className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {reward?.display_name || reward?.name || entry.reward_id || `${entry.currency_code || "Währung"} ${thisDraft.currency_amount ?? 0}`}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                            <Badge variant="outline" className="border-slate-600 text-slate-200">
                              {selectedSelectionGroup}
                            </Badge>
                            <Badge variant="outline" className="border-slate-600 text-slate-200">
                              {formatChance(entry.weight, visibleTotalWeight)}
                            </Badge>
                            {matchingEntryCount > 1 && (
                              <Badge variant="outline" className="border-emerald-500/50 text-emerald-200">
                                Synchronisiert in {matchingEntryCount} Knospen
                              </Badge>
                            )}
                            {entry.shared_only && <Badge variant="outline" className="border-amber-500/40 text-amber-200">Shared</Badge>}
                          </div>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteEntryMutation.mutate(entry.id)}
                          disabled={deleteEntryMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Löschen
                        </Button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Weight</Label>
                          <Input
                            type="number"
                            min="0"
                            value={thisDraft.weight}
                            onChange={(event) => setEntryDrafts((previous) => ({
                              ...previous,
                              [entry.id]: { ...thisDraft, weight: event.target.value },
                            }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Duplicate Seeds</Label>
                          <Input
                            type="number"
                            min="0"
                            value={thisDraft.duplicate_seed_value}
                            onChange={(event) => setEntryDrafts((previous) => ({
                              ...previous,
                              [entry.id]: { ...thisDraft, duplicate_seed_value: event.target.value },
                            }))}
                          />
                        </div>
                        {entry.currency_code && (
                          <div className="space-y-1">
                            <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Währungsbetrag</Label>
                            <Input
                              type="number"
                              min="1"
                              value={thisDraft.currency_amount}
                              onChange={(event) => setEntryDrafts((previous) => ({
                                ...previous,
                                [entry.id]: { ...thisDraft, currency_amount: event.target.value },
                              }))}
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Shared</Label>
                          <div className="flex h-10 items-center rounded-md border border-slate-700 bg-slate-950 px-3">
                            <input
                              type="checkbox"
                              checked={thisDraft.shared_only}
                              onChange={(event) => setEntryDrafts((previous) => ({
                                ...previous,
                                [entry.id]: { ...thisDraft, shared_only: event.target.checked },
                              }))}
                              className="h-4 w-4 accent-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            saveEntryMutation.mutate({
                              entry,
                              values: {
                                weight: toNumber(thisDraft.weight, entry.weight ?? 1),
                                duplicate_seed_value: toNumber(thisDraft.duplicate_seed_value, entry.duplicate_seed_value ?? 0),
                                shared_only: Boolean(thisDraft.shared_only),
                                ...(entry.currency_code && {
                                  currency_amount: toNumber(thisDraft.currency_amount, entry.currency_amount ?? 1),
                                }),
                              },
                            });
                          }}
                          disabled={saveEntryMutation.isPending}
                        >
                          {saveEntryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                          Eintrag speichern
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4">
              <h4 className="mb-3 text-base font-semibold text-white">Neuen Eintrag hinzufügen</h4>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1 xl:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Belohnung</Label>
                  <Select
                    value={newEntryDraft.reward_id}
                    onValueChange={(value) => setNewEntryDrafts((previous) => ({
                      ...previous,
                      [pool.id]: { ...newEntryDraft, reward_id: value },
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Belohnung wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {rewards.map((reward) => (
                        <SelectItem key={reward.id} value={reward.id}>
                          {reward.display_name || reward.name || reward.value || "Belohnung"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Weight</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEntryDraft.weight}
                    onChange={(event) => setNewEntryDrafts((previous) => ({
                      ...previous,
                      [pool.id]: { ...newEntryDraft, weight: event.target.value },
                    }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-[0.15em] text-slate-400">Duplicate Seeds</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEntryDraft.duplicate_seed_value}
                    onChange={(event) => setNewEntryDrafts((previous) => ({
                      ...previous,
                      [pool.id]: { ...newEntryDraft, duplicate_seed_value: event.target.value },
                    }))}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={newEntryDraft.shared_only}
                    onChange={(event) => setNewEntryDrafts((previous) => ({
                      ...previous,
                      [pool.id]: { ...newEntryDraft, shared_only: event.target.checked },
                    }))}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Nur für Shared-Zones
                </label>

                <Button
                  onClick={() => {
                    createEntryMutation.mutate({
                      poolId: pool.id,
                      values: {
                        reward_id: newEntryDraft.reward_id,
                        selection_group: selectedSelectionGroup,
                        weight: toNumber(newEntryDraft.weight, 1),
                        duplicate_seed_value: toNumber(newEntryDraft.duplicate_seed_value, 0),
                        shared_only: Boolean(newEntryDraft.shared_only),
                      },
                    });
                  }}
                  disabled={!newEntryDraft.reward_id || createEntryMutation.isPending}
                >
                  {createEntryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Eintrag hinzufügen
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_40%),linear-gradient(180deg,#020617,#0f172a_40%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-200" onClick={() => navigate("/") }>
              <ArrowLeft className="mr-2 h-4 w-4" /> Zur Startseite
            </Button>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/75">Admin</p>
              <h1 className="mt-2 text-3xl font-bold text-white">LootAdmin</h1>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-2">
            <Label htmlFor="lootbox-pool">Lootbox-Typ</Label>
            <Select value={selectedPool?.id || ""} onValueChange={setSelectedPoolId}>
              <SelectTrigger id="lootbox-pool" className="border-emerald-500/30 bg-slate-900/80 text-white">
                <SelectValue placeholder="Lootbox wählen" />
              </SelectTrigger>
              <SelectContent>
                {poolSummaries.map((pool) => (
                  <SelectItem key={pool.id} value={pool.id}>
                    {pool.name || pool.zone_theme || "Unbenannte Knospe"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(poolsLoading || rewardsLoading) ? (
          <Card className="border-slate-700 bg-slate-900/70 text-slate-100">
            <CardContent className="flex items-center justify-center gap-3 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
              Lade Lootbox-Konfiguration...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {selectedPool ? renderPoolCard(selectedPool) : (
              <Card className="border-slate-700 bg-slate-900/70 text-slate-100">
                <CardContent className="py-10 text-center text-slate-400">
                  Es sind noch keine Lootbox-Pools angelegt.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
