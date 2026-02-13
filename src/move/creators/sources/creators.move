module creator_platform::creator_registry {
    use std::string::String;
    use sui::table::{Self, Table};
    use sui::event;

    // Errors
    const EProfileAlreadyExists: u64 = 1;
    const EDescriptionTooLong: u64 = 2;

    // Constants
    const MAX_DESCRIPTION_LENGTH: u64 = 500;

    // =================== Structs ===================

    /// The User Profile object.
    /// We use 'key' so it has an ID, and 'store' so it can be transferred.
    public struct CreatorProfile has key, store {
        id: UID,
        name: String,
        description: String,
        owner: address,
    }

    /// A Shared Object to track which addresses have already registered.
    /// This prevents a single wallet from creating multiple profiles.
    public struct State has key {
        id: UID,
        /// Maps User Address -> Profile Object Address
        registry: Table<address, address>,
    }

    // =================== Events ===================

    /// Event emitted when a new creator registers
    public struct CreatorRegistered has copy, drop {
        creator_id: address,
        user_address: address,
        name: String,
    }

    /// Event emitted when a description is updated
    public struct DescriptionUpdated has copy, drop {
        creator_id: address,
        new_description: String,
    }

    // =================== Functions ===================

    /// Module initializer.
    /// Creates the global State object and shares it publicly.
    fun init(ctx: &mut TxContext) {
        transfer::share_object(State {
            id: object::new(ctx),
            registry: table::new(ctx),
        })
    }

    /// Create a new Creator Profile.
    /// Arguments are passed as bytes (vector<u8>) and converted to Strings.
    public fun register_creator(
        state: &mut State,
        name: vector<u8>,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = ctx.sender();

        // 1. Check if user already registered
        assert!(!table::contains(&state.registry, sender), EProfileAlreadyExists);

        // 2. Validate description length
        assert!(vector::length(&description) <= MAX_DESCRIPTION_LENGTH, EDescriptionTooLong);

        let name_str = name.to_string();
        let desc_str = description.to_string();

        // 3. Create the Profile Object
        let uid = object::new(ctx);
        let profile_address = object::uid_to_address(&uid);

        let profile = CreatorProfile {
            id: uid,
            name: name_str,
            description: desc_str,
            owner: sender,
        };

        // 4. Add to registry to prevent double registration
        table::add(&mut state.registry, sender, profile_address);

        // 5. Emit Event for indexers
        event::emit(CreatorRegistered {
            creator_id: profile_address,
            user_address: sender,
            name: profile.name,
        });

        // 6. Transfer the profile object to the user
        transfer::transfer(profile, sender);
    }

    /// Update the description of an existing profile.
    /// Only the owner of the CreatorProfile object can call this
    /// because they must pass the object as a mutable reference.
    public fun update_description(
        profile: &mut CreatorProfile,
        new_description: vector<u8>,
        _ctx: &mut TxContext
    ) {
        assert!(vector::length(&new_description) <= MAX_DESCRIPTION_LENGTH, EDescriptionTooLong);

        let desc_str = new_description.to_string();
        profile.description = desc_str;

        event::emit(DescriptionUpdated {
            creator_id: object::uid_to_address(&profile.id),
            new_description: profile.description,
        });
    }

    // =================== Getters ===================

    /// Read the name of a profile
    public fun name(profile: &CreatorProfile): &String {
        &profile.name
    }

    /// Read the description of a profile
    public fun description(profile: &CreatorProfile): &String {
        &profile.description
    }
}