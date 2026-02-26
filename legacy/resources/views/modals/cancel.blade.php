<modal name="cancel-modal">
    <h1 class="font-bold text-2xl mb-6">{{$heading ?? ''}}</h1>
    <p>
        {{$content ?? ''}}
    </p>
    <template v-slot:footer>
        <button @click="$modal.show('confirm-cancel-modal')" class="bg-red-700 hover:bg-red-900 px-4 py-2 mr-2 rounded text-sm text-white">Cancel</button>
        <button @click="$modal.hide('')" class="bg-blue-700 hover:bg-blue-900 px-4 py-2 rounded text-sm text-white">Continue</button>
        <confirm-button
            message="Are you sure?"
            cancel-button="Go Back"
            confirm-button="Continue"
            class="bg-blue-700 hover:bg-blue-900 px-4 py-2 rounded text-sm text-white"
        >Confirm
        </confirm-button>
    </template>
</modal>
