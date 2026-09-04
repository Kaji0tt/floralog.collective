import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Minus, Plus, Trash2, X } from "lucide-react";
import { Query } from "@/api/entities";
import {
  castCommunityTagVote,
  createCommunityTag,
  deleteCommunityTag,
  reportCommunityTag,
} from "@/api/communityTagService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const canContribute = (wallet) => Number(wallet?.lifetime_seeds_earned ?? 0) >= 5000;

export default function CommunityTagPanel({ plantId = null, genusId = null, currentUserId = null, isLightUi, embedded = false, compact = false }) {
  const [value, setValue] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const queryClient = useQueryClient();
  const targetColumn = plantId ? "plant_id" : "genus_id";
  const targetId = plantId || genusId;

  const { data: tags = [] } = useQuery({
    queryKey: ["communityTags", targetColumn, targetId],
    queryFn: () => Query.CommunityTag.filter({ [targetColumn]: targetId }),
    enabled: Boolean(targetId),
  });

  const { data: inheritedTags = [] } = useQuery({
    queryKey: ["communityTags", "genus_id", genusId],
    queryFn: () => Query.CommunityTag.filter({ genus_id: genusId }),
    enabled: Boolean(plantId && genusId),
  });

  const { data: allCommunityTags = [] } = useQuery({
    queryKey: ["communityTags"],
    queryFn: () => Query.CommunityTag.listAll(),
  });

  const { data: votes = [] } = useQuery({
    queryKey: ["communityTagVotes", currentUserId],
    queryFn: () => Query.CommunityTagVote.filter({ voter_auth_id: currentUserId }),
    enabled: Boolean(currentUserId),
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["userWallet", currentUserId],
    queryFn: () => Query.UserWallet.filter({ auth_id: currentUserId }),
    enabled: Boolean(currentUserId),
  });

  const refreshTags = () => {
    queryClient.invalidateQueries({ queryKey: ["communityTags"] });
    queryClient.invalidateQueries({ queryKey: ["communityTagVotes"] });
    queryClient.invalidateQueries({ queryKey: ["userWallet"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createCommunityTag({ plantId, genusId, value }),
    onSuccess: () => {
      setValue("");
      setShowAddInput(false);
      refreshTags();
    },
  });

  const voteMutation = useMutation({
    mutationFn: castCommunityTagVote,
    onSuccess: refreshTags,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCommunityTag,
    onSuccess: refreshTags,
  });

  const reportMutation = useMutation({
    mutationFn: ({ tagId }) => reportCommunityTag({ tagId, reason: "Von der Community gemeldet" }),
  });

  const ownVoteByTagId = new Map((votes || []).map((vote) => [vote.tag_id, vote.vote]));
  const wallet = Array.isArray(wallets) ? wallets[0] || null : wallets || null;
  const eligible = canContribute(wallet);
  const activeTags = (tags || []).filter((tag) => tag.status === "active");
  const activeInheritedTags = (inheritedTags || []).filter((tag) => tag.status === "active");
  const inheritedNormalizedValues = new Set(activeInheritedTags.map((tag) => tag.normalized_value));
  const visibleTags = plantId
    ? [...activeInheritedTags, ...activeTags.filter((tag) => !inheritedNormalizedValues.has(tag.normalized_value))]
    : activeTags;
  const normalizedValue = value.trim().toLowerCase();
  const suggestionByNormalizedValue = new Map();
  [...visibleTags, ...(allCommunityTags || []).filter((tag) => tag.status === "active")].forEach((tag) => {
    if (!suggestionByNormalizedValue.has(tag.normalized_value)) {
      suggestionByNormalizedValue.set(tag.normalized_value, tag);
    }
  });
  const matchingSuggestions = Array.from(suggestionByNormalizedValue.values()).filter((tag) =>
    normalizedValue && tag.normalized_value.includes(normalizedValue)
  );
  const hasExactTargetTag = visibleTags.some((tag) => tag.normalized_value === normalizedValue);
  const mutedText = isLightUi ? "text-stone-500" : "text-stone-400";

  if (compact) {
    const chipClass = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs " + (isLightUi
      ? "border-stone-300 bg-stone-100 text-stone-700"
      : "border-stone-500 bg-stone-800 text-stone-200");

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleTags.map((tag) => {
          const isCreator = tag.created_by_auth_id === currentUserId;
          const ownVote = ownVoteByTagId.get(tag.id) ?? null;
          const canVote = currentUserId && !isCreator && eligible;
          return (
            <span key={tag.id} className={chipClass}>
              {canVote && (
                <button
                  type="button"
                  title="Positiv bewerten"
                  onClick={() => voteMutation.mutate({ tagId: tag.id, vote: ownVote === 1 ? null : 1 })}
                  className={"leading-none " + (ownVote === 1 ? "text-emerald-500" : "opacity-70 hover:opacity-100")}
                >
                  +
                </button>
              )}
              <span className="max-w-24 truncate">{tag.value}</span>
              {canVote && (
                <button
                  type="button"
                  title="Negativ bewerten"
                  onClick={() => voteMutation.mutate({ tagId: tag.id, vote: ownVote === -1 ? null : -1 })}
                  className={"leading-none " + (ownVote === -1 ? "text-rose-500" : "opacity-70 hover:opacity-100")}
                >
                  −
                </button>
              )}
              {isCreator && (
                <button type="button" title="Tag entfernen" onClick={() => deleteMutation.mutate(tag.id)} className="opacity-70 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}

        {currentUserId && (
          showAddInput ? (
            <form
              className="inline-flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (value.trim() && !hasExactTargetTag) createMutation.mutate();
              }}
            >
              <Input
                autoFocus
                value={value}
                maxLength={32}
                list={`community-tag-suggestions-${targetId}`}
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => { if (!value.trim()) setShowAddInput(false); }}
                placeholder="Tag"
                aria-label="Neuer Community-Tag"
                className="h-7 w-28 px-2 text-xs"
              />
              <datalist id={`community-tag-suggestions-${targetId}`}>
                {matchingSuggestions.map((tag) => <option key={tag.id} value={tag.value} />)}
              </datalist>
              <Button type="submit" size="icon" className="h-6 w-6" title="Tag hinzufügen" disabled={!value.trim() || hasExactTargetTag || createMutation.isPending}>
                <Plus className="h-3 w-3" />
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => eligible && setShowAddInput(true)}
              disabled={!eligible}
              title={eligible ? "Tag hinzufügen" : "Ab 5.000 insgesamt verdienten Samen kannst du Tags erstellen"}
              className={chipClass + (eligible ? " hover:opacity-80" : " opacity-50 cursor-not-allowed")}
            >
              <Plus className="h-3 w-3" />
            </button>
          )
        )}
      </div>
    );
  }

  const content = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={isLightUi ? "font-semibold text-stone-900" : "font-semibold text-[#f8f4d6]"}>Community-Tags</h2>
        <span className={`text-xs ${mutedText}`}>{visibleTags.length}</span>
      </div>

      {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleTags.map((tag) => {
              const ownVote = ownVoteByTagId.get(tag.id) ?? null;
              const isCreator = tag.created_by_auth_id === currentUserId;
              const scoreClass = tag.score >= 2
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700"
                : tag.score === 1
                  ? (isLightUi ? "border-stone-300 bg-stone-100 text-stone-700" : "border-stone-500 bg-stone-800 text-stone-200")
                  : (isLightUi ? "border-stone-200 bg-stone-50 text-stone-500 text-xs" : "border-stone-700 bg-stone-900 text-stone-400 text-xs");

              return (
                <div key={tag.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${scoreClass}`}>
                  <span className="max-w-32 truncate">{tag.value}</span>
                  <span className="text-xs tabular-nums">{tag.score > 0 ? `+${tag.score}` : tag.score}</span>
                  {!isCreator && eligible && (
                    <>
                      <Button type="button" variant="ghost" size="icon" className={`h-5 w-5 ${ownVote === 1 ? "text-emerald-600" : ""}`} title="Positiv bewerten" onClick={() => voteMutation.mutate({ tagId: tag.id, vote: ownVote === 1 ? null : 1 })}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className={`h-5 w-5 ${ownVote === -1 ? "text-rose-600" : ""}`} title="Negativ bewerten" onClick={() => voteMutation.mutate({ tagId: tag.id, vote: ownVote === -1 ? null : -1 })}>
                        <Minus className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {isCreator ? (
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" title="Eigenen Tag entfernen" onClick={() => deleteMutation.mutate(tag.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" title="Tag melden" onClick={() => reportMutation.mutate({ tagId: tag.id })}>
                      <Flag className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
      )}

      {currentUserId && (
          eligible ? (
            <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (value.trim() && !hasExactTargetTag) createMutation.mutate(); }}>
              <div className="flex gap-2">
                <Input value={value} maxLength={32} list={`community-tag-suggestions-${targetId}`} onChange={(event) => setValue(event.target.value)} placeholder="Tag hinzufügen" aria-label="Neuer Community-Tag" />
                <datalist id={`community-tag-suggestions-${targetId}`}>
                  {matchingSuggestions.map((tag) => <option key={tag.id} value={tag.value} />)}
                </datalist>
                <Button type="submit" size="icon" title="Tag hinzufügen" disabled={!value.trim() || hasExactTargetTag || createMutation.isPending}>
                <Plus className="h-4 w-4" />
                </Button>
              </div>
              {matchingSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {matchingSuggestions.map((tag) => (
                    <button key={tag.id} type="button" onClick={() => setValue(tag.value)} className={`rounded-md border px-2 py-0.5 text-xs ${isLightUi ? "border-stone-200 text-stone-600 hover:bg-stone-100" : "border-stone-600 text-stone-300 hover:bg-stone-800"}`}>
                      {tag.value}
                    </button>
                  ))}
                </div>
              )}
              {hasExactTargetTag && <p className={`text-xs ${mutedText}`}>Dieser Tag existiert bereits für dieses Ziel.</p>}
            </form>
          ) : (
            <p className={`text-xs ${mutedText}`}>Ab 5.000 insgesamt verdienten Samen kannst du Tags erstellen und bewerten.</p>
          )
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <Card className={isLightUi ? "border-stone-200 bg-white" : "border-[#f0e5a5]/35 bg-black/40 backdrop-blur-sm"}>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}