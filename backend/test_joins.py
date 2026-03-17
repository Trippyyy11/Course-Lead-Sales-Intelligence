import pandas as pd
import numpy as np

def mock_load_dataframe(data):
    return pd.DataFrame(data)

def perform_join_logic(df_a, df_b, keys_a, keys_b, join_type):
    df_a = df_a.copy()
    df_b = df_b.copy()

    if join_type == "append":
        common_columns = list(set(df_a.columns) & set(df_b.columns))
        return pd.concat([df_a[common_columns], df_b[common_columns]], ignore_index=True)
    elif join_type == "left_anti":
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="left", indicator=True, suffixes=("_fileA", "_fileB"))
        return merged_df[merged_df["_merge"] == "left_only"].drop(columns=["_merge"])
    elif join_type == "right_anti":
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="right", indicator=True, suffixes=("_fileA", "_fileB"))
        return merged_df[merged_df["_merge"] == "right_only"].drop(columns=["_merge"])
    elif join_type == "full_anti":
        merged_df = pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how="outer", indicator=True, suffixes=("_fileA", "_fileB"))
        return merged_df[merged_df["_merge"] != "both"].drop(columns=["_merge"])
    else:
        return pd.merge(df_a, df_b, left_on=keys_a, right_on=keys_b, how=join_type, suffixes=("_fileA", "_fileB"))

def test_joins():
    data_a = {"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"]}
    data_b = {"id": [2, 3, 4], "age": [25, 30, 35]}
    df_a = pd.DataFrame(data_a)
    df_b = pd.DataFrame(data_b)
    
    keys = ["id"]

    print("Testing 'full_anti' (Symmetric Difference)...")
    result = perform_join_logic(df_a, df_b, keys, keys, "full_anti")
    print(result)
    # Expected: id 1 (Alice) and id 4 (35)
    assert 1 in result["id"].values
    assert 4 in result["id"].values
    assert 2 not in result["id"].values
    assert 3 not in result["id"].values
    print("✓ full_anti passed\n")

    print("Testing 'left_anti'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "left_anti")
    print(result)
    # Expected: id 1 (Alice)
    assert 1 in result["id"].values
    assert 2 not in result["id"].values
    assert 3 not in result["id"].values
    print("✓ left_anti passed\n")

    print("Testing 'right_anti'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "right_anti")
    print(result)
    # Expected: id 4 (35)
    assert 4 in result["id"].values
    assert 2 not in result["id"].values
    assert 3 not in result["id"].values
    print("✓ right_anti passed\n")

    print("Testing 'outer'...")
    result = perform_join_logic(df_a, df_b, keys, keys, "outer")
    print(result)
    # Expected: id 1, 2, 3, 4
    assert set(result["id"].values) == {1, 2, 3, 4}
    print("✓ outer passed\n")

    print("All tests passed!")

if __name__ == "__main__":
    test_joins()
