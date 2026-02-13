Here is the updated Move smart contract tailored for **Walrus**.

Instead of storing a long description string on-chain (which is expensive), we store a **`u256` Walrus Blob ID**. This ID points to a file (JSON, Image, or HTML) stored on the Walrus protocol that contains all the creator's rich data.

```move
module creator_platform::walrus_registry {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::event;

    // Errors
    const EProfileAlreadyExists: u64 = 1;

    // =================== Structs ===================

    /// The User Profile object.
    public struct CreatorProfile has key, store {
        id: UID,
        name: String,      // Keep name on-chain for easy listing
        blob_id: u256,     // The Walrus Blob ID pointing to off-chain data
        owner: address,
    }

    /// Shared Object to prevent double registration
    public struct State has key {
        id: UID,
        registry: Table<address, address>,
    }

    // =================== Events ===================

    public struct CreatorRegistered has copy, drop {
        creator_id: address,
        user_address: address,
        name: String,
        blob_id: u256,
    }

    public struct BlobIdUpdated has copy, drop {
        creator_id: address,
        new_blob_id: u256,
    }

    // =================== Functions ===================

    fun init(ctx: &mut TxContext) {
        transfer::share_object(State {
            id: object::new(ctx),
            registry: table::new(ctx),
        })
    }

    /// Register a new creator with a Name and a Walrus Blob ID.
    /// Note: Walrus Blob IDs are u256.
    public entry fun register_creator(
        state: &mut State,
        name: vector<u8>,
        blob_id: u256,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // Check if user already registered
        assert!(!table::contains(&state.registry, sender), EProfileAlreadyExists);

        let name_str = string::utf8(name);

        let uid = object::new(ctx);
        let profile_address = object::uid_to_address(&uid);

        let profile = CreatorProfile {
            id: uid,
            name: name_str,
            blob_id: blob_id,
            owner: sender,
        };

        table::add(&mut state.registry, sender, profile_address);

        event::emit(CreatorRegistered {
            creator_id: profile_address,
            user_address: sender,
            name: profile.name,
            blob_id: blob_id,
        });

        transfer::transfer(profile, sender);
    }

    /// Update the Walrus Blob ID (e.g., user updated their bio/avatar off-chain).
    public entry fun update_blob_id(
        profile: &mut CreatorProfile,
        new_blob_id: u256,
        _ctx: &mut TxContext
    ) {
        profile.blob_id = new_blob_id;

        event::emit(BlobIdUpdated {
            creator_id: object::uid_to_address(&profile.id),
            new_blob_id: new_blob_id,
        });
    }

    // =================== Getters ===================

    public fun get_blob_id(profile: &CreatorProfile): u256 {
        profile.blob_id
    }
}
```

### Key Changes for Walrus Integration

1.  **`blob_id: u256`**:
    Walrus Blob IDs are 256-bit integers (32 bytes). We use the `u256` type in Move to store this efficiently.

    - _Note:_ If your frontend has the ID as a Hex string (e.g., `0x123...abc`), the Sui TS SDK will handle the conversion when calling the function, provided you pass it as a string or BigInt.

2.  **Cost Efficiency**:
    By moving the `description` (and potentially avatar URLs, social links, etc.) into the Walrus Blob, the storage cost on Sui becomes fixed and very cheap, regardless of how much data the creator adds to their profile.

3.  **Workflow**:
    1.  **Frontend:** Upload JSON `{ "description": "...", "avatar": "..." }` to Walrus Publisher.
    2.  **Walrus:** Returns a `blob_id`.
    3.  **Sui:** Call `register_creator` with that `blob_id`.
