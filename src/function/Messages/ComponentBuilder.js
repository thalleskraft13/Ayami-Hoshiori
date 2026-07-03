class ComponentBuilder {

    constructor() {
        this.rows = [];
        this.currentRow = null;
    }

    /* =========================
       Create New Action Row
    ========================== */
    newRow() {
        this.currentRow = {
            type: 1,
            components: []
        };

        this.rows.push(this.currentRow);
        return this;
    }

    /* =========================
       Add Button
       style:
       1 = Primary
       2 = Secondary
       3 = Success
       4 = Danger
       5 = Link
    ========================== */
    addButton({
        label,
        customId,
        style = 1,
        url = null,
        disabled = false,
        emoji = null
    }) {

        if (!this.currentRow)
            this.newRow();

        const button = {
            type: 2,
            style,
            disabled
        };

        if (style === 5 && url) {
            button.url = url;
        } else {
            button.custom_id = customId;
        }

        if (label) button.label = label;
        if (emoji) button.emoji = emoji;

        this.currentRow.components.push(button);

        return this;
    }

    /* =========================
       Add String Select Menu
    ========================== */
    addSelectMenu({
        customId,
        placeholder,
        options = [],
        minValues = 1,
        maxValues = 1
    }) {

        if (!this.currentRow)
            this.newRow();

        const menu = {
            type: 3,
            custom_id: customId,
            placeholder,
            min_values: minValues,
            max_values: maxValues,
            options: options.map(opt => ({
                label: opt.label,
                value: opt.value,
                description: opt.description,
                emoji: opt.emoji
            }))
        };

        this.currentRow.components.push(menu);

        return this;
    }

    /* =========================
       Add Modal (static helper)
    ========================== */
    static createModal({
        customId,
        title,
        inputs = []
    }) {

        return {
            type: 9,
            data: {
                custom_id: customId,
                title,
                components: inputs.map(input => ({
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: input.customId,
                        label: input.label,
                        style: input.style ?? 1,
                        min_length: input.minLength ?? 0,
                        max_length: input.maxLength ?? 4000,
                        required: input.required ?? true,
                        placeholder: input.placeholder
                    }]
                }))
            }
        };
    }

    /* =========================
       Return Only Components
    ========================== */
    build() {
        return this.rows;
    }

}

module.exports = ComponentBuilder;