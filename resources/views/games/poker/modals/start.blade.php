<modal name="start-game">
    <h1 class="font-bold text-2xl mb-6">{{"Ready to play, ".optional(auth()->user())->name."?"}}</h1>
    <p>
        {{$content ?? ''}}
    </p>
    <template v-slot:footer>
        <div>
            <label for="amount">$Amount to take to the table:</label>
            <input type="number" name="amount" placeholder="$0" class="mt-2 py-2 px-1 text-2xl bg-gray-200 rounded"/>
        </div>
        <button @click="$modal.show('confirm-cancel-modal')" class="bg-red-700 hover:bg-red-900 px-4 py-2 mr-2 rounded text-sm text-white">Cancel</button>
        <button @click="$game.start('poker')" class="bg-blue-700 hover:bg-blue-900 px-4 py-2 rounded text-sm text-white">Start Game</button>
    </template>
</modal>
