---
title: "The Case of the Frozen Trove"
pubDate: 2024-07-26
tags: ["world of warcraft"]
---

Recently, there's been a number of (mostly Remix-related) Transmog addons experiencing an issue that causes the game to lock up on first login and never* recover. Most of these addons have implemented workarounds for the issue but I figured I'd take the time to document the actual cause.

**Disclaimer**: Most of my testing was done *before* the release of the 11.0.0 prepatch. The information below should still be accurate.

### Update 07/26/2024
- I believe **Trove Tally** is the only addon that is still actively causing this bug to occur. I made an attempt to look into the addon code and figure out exactly where the problem was living, but made little progress.
- I've been hearing reports that the occurence of this bug is no longer limited to Remix characters.

**What to do:** 
- If your game is freezing indefinitely just after the initial loading screen, disable the Trove Tally addon before logging in. I'd recommend uninstalling the addon entirely given the nature of the issues it causes.

**But how do I disable addons before logging in?**
- Click the "Menu" button at the top of the character select screen, then click "Addons" to manage your addons.

<!-- truncate -->

## The TLDR
Certain addons are requesting item data for all the appearances your character can possibly learn, right at login. This leads to the backend **DB Rec Callbacks** system becoming overwhelmed and causes the game to get stuck in some sort of infinite loop and freeze indefinitely. This usually requires you to manually kill the task, or, after a certain amount of time, the game will run out of memory and crash itself.

This issue has likely been exacerbated by the release of patch 11.0.0 because it nearly tripled the number of appearances available to any given character.

# The Issue
Somewhere deep down within the game client there's some code responsible for allocating memory for these item callbacks - the game calls them **DB Rec Callbacks**. Once you reach a certain number of these callbacks in memory the game will lock up and seemingly create an infinite loop of memory leaking until the game finally goes "we've run out memory, man." and gives up.

We get some clues by running our test code on a test client, since those will generate error logs when you're getting close to reaching the maximum number of allocations. In my testing, I was able to reproduce the issue on both 10.2.7.55461 and 11.0.2.55522.

```
Error: ERROR #135 (0x85110087) Non-fatal assertion failure!
Description: "m_alerted || m_currentHeap < 10000", Creating a large amount of DB Rec Callbacks heaps -- count: 10000, numFullheaps: 10000, objsPerBlock: 256
File: D:\BuildServer\D\work-git\wow\Engine\Source\ObjectAlloc\ObjectAlloc.cpp
Line: 103
```

## Is this *really* an issue?
Generally, there's not much of a reason to request data for *this* many items. I personally believe that if you're requesting this many items at once, there's probably a more elegant design lurking somewhere. However, there are reasons some addons end up doing exactly this, mostly for caching data upfront rather than requesting everything dynamically.

The return value from `C_TransmogCollection.GetCategoryAppearances` is based on your current class in the current live game, but on the Beta and in TWW, it doesn't appear to be. Meaning, on Retail, my characters only have ~25,000 appearances available to them, while on the Beta they have ~76,000 available. During my brief testing, requesting item data for *all* of these appearances worked fine for non-Remix characters.

The meat of the issue is that the action of fetching an item from the DB2s is significantly more expensive on Remix characters, meaning you can very easily hit the limit for the number of 'concurrent' item requests at barely ~14,000 item requests. One theory I have for this behavior is that with the Transmog set/ensemble fixes that were implemented semi-recently to Remix, there's a bunch of caching already taking place in the background, so when the addons load on top of that and *also* request all the appearances, chaos ensues.

At the end of the day, this sort of catastrophic client crash should probably be something that addons can't achieve on accident. The combination of popular Transmog addons caching known items at login, the extremely large number of appearances available to Remix characters, and the requests going out during the busiest period of the loading cycle creates a perfect storm for this trio to demolish the client.

# The Code
```lua
local MAX_ITEMS = 25000; -- tweak this number up until your game freezes just after the loading screen ends

function CACHE_TEST()
    print("Running cache test...");
    local ITEM_QUEUE_LOOKUP = {};
    local REQUEST_QUEUE = {};

    for categoryType = Enum.TransmogCollectionTypeMeta.MinValue, Enum.TransmogCollectionTypeMeta.MaxValue do
        local slotID = CollectionWardrobeUtil.GetSlotFromCategoryID(categoryType) or 1;
        local transmogLocation = TransmogUtil.GetTransmogLocation(slotID, Enum.TransmogType.Appearance, Enum.TransmogModification.Main);
        local all_appearances = C_TransmogCollection.GetCategoryAppearances(categoryType, transmogLocation);
        for i, appearance in ipairs(all_appearances) do
            local all_sources = C_TransmogCollection.GetAllAppearanceSources(appearance.visualID);
            for _, sourceID in ipairs(all_sources) do
                local itemID = C_TransmogCollection.GetSourceItemID(sourceID);
                if not C_Item.IsItemDataCachedByID(itemID) and not ITEM_QUEUE_LOOKUP[itemID] then
                    tinsert(REQUEST_QUEUE, itemID);
                    ITEM_QUEUE_LOOKUP[itemID] = true;
                end
            end
        end
    end

    print("Number of uncached SourceItemIDs: " .. #REQUEST_QUEUE);
    for i=1, MAX_ITEMS do
        local itemID = REQUEST_QUEUE[i];
        C_Item.RequestLoadItemDataByID(itemID);
    end
    ConsoleExec("HeapUsage");
end

EventUtil.RegisterOnceFrameEventAndCallback("FIRST_FRAME_RENDERED", CACHE_TEST);

local function CONSOLE_MESSAGE(_, _, message)
    if string.match(message, "DB Rec Callbacks") then
        local obj_allocated = string.match(message, "(%d+) objs allocated");
        local alloc_percent = string.match(message, "objs allocated %( (%d+)");
        local total_alloc = string.match(message, "Total Allocs:%s*(%d+)");
        print(format("Active Objects: %d | Alloc Percentage: %d%% | Total Allocations: %d", obj_allocated, alloc_percent), total_alloc);
    end
end

local f = CreateFrame("Frame");
f:RegisterEvent("CONSOLE_MESSAGE");
f:SetScript("OnEvent", CONSOLE_MESSAGE);
```

Essentially, we're looping over all of the Transmog categories, grabbing all the appearanceIDs for those categories. We then grab all of the appearance sourceIDs for each appearanceID. From the sourceID, we find the itemID, then add it to a list and request all of the items at once at the end.

At the top of the example, there's a constant called `MAX_ITEMS`, this constrains the number of requests we can make. I used this for 'limit testing' to see where the game started breaking. For my Remix character on the Beta, the breakage began around `MAX_ITEMS=14000`. Outside of manually tweaking that limit, this where the output from the `HeapUsage` command can be helpful though, as it gives us an 'alloc percentage' and tells us how many total allocations there have been. 

**Note:** This command is not available in release clients. For my testing using this command I was on the TWW Beta, 11.0.2.55522

# Repro
Reproducing this bug is quite simple but it requires a bit of finesse to extract any useful information from it during the process, since, as mentioned above, it freezes the client indefinitely. However, since this data loading is asynchronous, we get a frame or two to find some data to print to the chat box before it all falls apart.

The following conditions must be met in order for the bug to occur using the provided above code:
- It must be the first time you've loaded into the world in that session. This is the best time since the cache is (mostly) empty, and there can be multiple different addons or internal functions requesting item data, meaning you're more likely to hit the cap.
- You must be logging into a MoP Remix character. In my testing, I used a Priest.

# Notes
I noticed that the amount of time the game freezes for seems to be related to how far over the limit you go with your requests. If you just pass the limit by a few, it freezes for a few seconds, then figures everything out. However, at a certain point it won't be able to recover before the game destroys itself.

I've heard one report that this whole 'cache all the items at login' practice was pretty standard for a long time, then in some recent build, this bug appeared and started bricking people's games.
