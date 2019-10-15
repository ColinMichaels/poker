<h1 class="text-2xl font-bold mb-8">Confirmation Dialogs</h1>
<div class="mb-6">
    <form method="POST">
        <confirm-button
            message="Are you sure you want to cancel your account?"
            class="bg-blue-500 hover:bg-blue-600 py-2 px-4 text-white rounded-lg"
        >
            Option 1
        </confirm-button>
    </form>
</div>
<div class="mb-6">
    <form method="POST">
        <confirm-button
            message="Are you sure you want to cancel your account?"
            cancel-button="Go Back"
            confirm-button="Continue On"
            class="bg-blue-500 hover:bg-blue-600 py-2 px-4 text-white rounded-lg"
        >
            Option 2
        </confirm-button>
    </form>
</div>
<div class="mb-6">
    <form method="POST" @submit.prevent="confirm('Are you really sure about this?')">
        <button class="bg-blue-500 hover:bg-blue-600 py-2 px-4 text-white rounded-lg">
            Option 3
        </button>
    </form>
</div>
<confirm-dialog></confirm-dialog>
