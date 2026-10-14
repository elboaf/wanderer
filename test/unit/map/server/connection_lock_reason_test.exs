defmodule WandererApp.Map.Server.ConnectionLockReasonTest do
  @moduledoc """
  The save-mass lock carries a reason.

  Covers the round trip introduced with the lock-reason feature: locking with
  a reason persists it on the connection and in the lock-info cache, unlocking
  clears both, re-locking without a reason does not resurrect an old one, and
  `get_connection_info/2` resolves reason + author + time for the tooltip.
  Also pins the REST path (`Operations.update_connection/3`) where the reason
  rides along with the `locked` field.
  """

  use WandererApp.DataCase, async: false

  import Mox

  alias WandererApp.Cache
  alias WandererApp.Map.Operations.Connections
  alias WandererApp.Map.Server
  alias WandererApp.MapConnectionRepo
  alias WandererAppWeb.Factory

  @source 30_000_142
  @target 30_000_143

  setup :verify_on_exit!

  setup do
    # Mocks are already in global mode from application startup
    character = Factory.create_character()
    map = Factory.create_map(%{owner_id: character.id})

    connection =
      Factory.create_map_connection(map.id, %{
        solar_system_source: @source,
        solar_system_target: @target,
        type: 0,
        locked: false
      })

    # Seed the map-state cache the way a started map server would, so the
    # connection update flow can find the pair without booting a MapPool.
    map_state = %WandererApp.Map{map_id: map.id}
    Cachex.put(:map_cache, map.id, map_state)

    WandererApp.Map.update_map(map.id, %{
      connections: Map.put(Map.new(), "#{@source}_#{@target}", connection)
    })

    %{
      map: map,
      character: character,
      connection: connection
    }
  end

  defp get_connection(map_id, connection_id) do
    assert {:ok, conn} = MapConnectionRepo.get_by_id(map_id, connection_id)
    conn
  end

  describe "update_connection_locked/2" do
    test "persists the reason with the flag and resolves it back out", %{
      map: map,
      character: character,
      connection: connection
    } do
      :ok =
        Server.update_connection_locked(map.id, %{
          solar_system_source_id: @source,
          solar_system_target_id: @target,
          locked: true,
          locked_reason: "Cleared for capital injection",
          character_id: character.id
        })

      updated = get_connection(map.id, connection.id)
      assert updated.locked == true
      assert updated.locked_reason == "Cleared for capital injection"

      assert {:ok, info} =
               Server.get_connection_info(map.id, %{
                 solar_system_source_id: @source,
                 solar_system_target_id: @target
               })

      assert info.locked_reason == "Cleared for capital injection"
      assert info.locked_by_name == character.name
      assert %DateTime{} = info.locked_at
    end

    test "unlocking clears the reason from both the record and the cache", %{
      map: map,
      character: character,
      connection: connection
    } do
      :ok =
        Server.update_connection_locked(map.id, %{
          solar_system_source_id: @source,
          solar_system_target_id: @target,
          locked: true,
          locked_reason: "temp",
          character_id: character.id
        })

      :ok =
        Server.update_connection_locked(map.id, %{
          solar_system_source_id: @source,
          solar_system_target_id: @target,
          locked: false,
          character_id: character.id
        })

      updated = get_connection(map.id, connection.id)
      assert updated.locked == false
      assert updated.locked_reason == nil

      assert {:ok, info} =
               Server.get_connection_info(map.id, %{
                 solar_system_source_id: @source,
                 solar_system_target_id: @target
               })

      assert info.locked_reason == nil
      assert info.locked_by_name == nil
      assert info.locked_at == nil
    end

    test "re-locking without a reason does not resurrect the previous one", %{
      map: map,
      character: character,
      connection: connection
    } do
      :ok =
        Server.update_connection_locked(map.id, %{
          solar_system_source_id: @source,
          solar_system_target_id: @target,
          locked: true,
          locked_reason: "first",
          character_id: character.id
        })

      :ok =
        Server.update_connection_locked(map.id, %{
          solar_system_source_id: @source,
          solar_system_target_id: @target,
          locked: false,
          character_id: character.id
        })

      :ok =
        Server.update_connection_locked(map.id, %{
          solar_system_source_id: @source,
          solar_system_target_id: @target,
          locked: true,
          character_id: character.id
        })

      updated = get_connection(map.id, connection.id)
      assert updated.locked == true
      assert updated.locked_reason == nil

      assert {:ok, info} =
               Server.get_connection_info(map.id, %{
                 solar_system_source_id: @source,
                 solar_system_target_id: @target
               })

      assert info.locked_reason == nil
    end

    test "a legacy lock-info entry without a reason reads as no reason", %{map: map} do
      {:ok, %{id: connection_id}} =
        WandererApp.Map.find_connection(map.id, @source, @target)

      Cache.put("map_#{map.id}:conn_#{connection_id}:locked_info", %{
        locked_by_id: Ecto.UUID.generate(),
        locked_at: DateTime.utc_now()
      })

      assert {:ok, info} =
               Server.get_connection_info(map.id, %{
                 solar_system_source_id: @source,
                 solar_system_target_id: @target
               })

      assert info.locked_reason == nil
    end
  end

  describe "Operations.update_connection/3 (REST path)" do
    test "applies the flag together with the reason", %{
      map: map,
      connection: connection
    } do
      conn = %{assigns: %{map_id: map.id, owner_character_id: Ecto.UUID.generate()}}

      assert {:ok, _updated} =
               Connections.update_connection(conn, connection.id, %{
                 "locked" => true,
                 "locked_reason" => "Keep intact for move op"
               })

      updated = get_connection(map.id, connection.id)
      assert updated.locked == true
      assert updated.locked_reason == "Keep intact for move op"
    end

    test "a reason-only update is ignored (reason travels with the flag)", %{
      map: map,
      connection: connection
    } do
      conn = %{assigns: %{map_id: map.id, owner_character_id: Ecto.UUID.generate()}}

      assert {:ok, _updated} =
               Connections.update_connection(conn, connection.id, %{
                 "locked_reason" => "orphan reason"
               })

      updated = get_connection(map.id, connection.id)
      assert updated.locked == false
      assert updated.locked_reason == nil
    end
  end
end
