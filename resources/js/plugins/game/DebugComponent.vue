<template>
    <div>
        <button class="hover:underline text-gray-300  text-xs absolute right-0 pr-4" @click="toggleDebug">{{ debug ? 'Hide' : 'Show'}} Debug</button>
        <div id="debug" class="mb-10" v-show="debug">
            <div class="bg-gray-200 py-4 px-6 font-mon flex flex-row">
                <div class="w-1/4">
                    <p>Wallet (db): {{$page.auth.user.player.wallet}}<br>
                        Wallet (async): {{ player_wallet }}<br>
                        Current Money At Table : {{ player_hand }}<br>
                        Bet: {{ current_bet }}<br>
                        Last Bet: {{last_bet}}<br>
                        Round: {{round }}</p>
                </div>
                <div class="flex flex-col my-4"  v-show="current_card">
                    <h4>Card to Find: {{card_to_find}}</h4>
                    <h4>Current Card: {{current_card}}</h4>
                    <div class="w-full overflow-scroll h-32 my-2">
                        <ul class="flex flex-wrap-reverse">
                            <li class="w-1/8" v-for="card in card_chosen">
                                <card :name="card" :is_flipped="true" :is_frozen="true"></card>
                            </li>
                        </ul>
                    </div>
                    <h3>Cards Chosen: {{card_chosen}}</h3>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Card from "@/components/Poker/Card";
    export default {
        name: "DebugComponent",
        components: {
          Card
        },
        data(){
            return {
                player_wallet: 0,
                player_hand: 0,
                current_bet: 0,
                last_bet: 0,
                round: 0
            }
        }
    }
</script>
